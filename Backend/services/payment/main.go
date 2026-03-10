package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

const lipiaBaseURL = "https://lipia-api.kreativelabske.com/api/v2"

// ─── Models ──────────────────────────────────────────────────────────────────

type PaymentRequest struct {
	ID                 string  `json:"id"`
	StoreID            *string `json:"store_id"`
	UserID             *string `json:"user_id"`
	PhoneNumber        string  `json:"phone_number"`
	Amount             float64 `json:"amount"`
	ExternalReference  *string `json:"external_reference"`
	TransactionRef     *string `json:"transaction_reference"`
	MpesaReceiptNumber *string `json:"mpesa_receipt_number"`
	Status             string  `json:"status"`
	ResultDesc         *string `json:"result_desc"`
	Metadata           []byte  `json:"metadata,omitempty"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
}

// ─── DB ──────────────────────────────────────────────────────────────────────

var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			getEnv("DB_HOST", "localhost"), getEnv("DB_PORT", "5432"),
			getEnv("DB_USER", "postgres"), getEnv("DB_PASSWORD", "postgres"),
			getEnv("DB_NAME", "multivendor"))
	}
	var err error
	for i := 0; i < 10; i++ {
		db, err = sql.Open("postgres", dsn)
		if err == nil {
			err = db.Ping()
		}
		if err == nil {
			break
		}
		log.Printf("DB not ready, retrying... (%d/10)", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	db.SetMaxOpenConns(10)
	log.Println("Payment service: DB connected")
}

func getEnv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("multivendor-super-secret-jwt-key-change-in-prod")
}

func validateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// ─── Middleware ───────────────────────────────────────────────────────────────

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}
		claims, err := validateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("user_type", claims.UserType)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// ─── Phone Formatter ─────────────────────────────────────────────────────────

func formatKenyanPhone(phone string) (string, error) {
	phone = regexp.MustCompile(`\s+`).ReplaceAllString(phone, "")
	phone = regexp.MustCompile(`[^0-9+]`).ReplaceAllString(phone, "")
	phone = strings.TrimPrefix(phone, "+")

	switch {
	case strings.HasPrefix(phone, "254"):
		// already correct
	case strings.HasPrefix(phone, "0"):
		phone = "254" + phone[1:]
	case strings.HasPrefix(phone, "7") || strings.HasPrefix(phone, "1"):
		phone = "254" + phone
	}

	matched, _ := regexp.MatchString(`^254[17]\d{8}$`, phone)
	if !matched {
		return "", fmt.Errorf("invalid Kenyan phone number format")
	}
	return phone, nil
}

// ─── STK Push Handlers ───────────────────────────────────────────────────────

// POST /payments/mpesa/initiate
func handleInitiateMpesa(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		StoreID           string      `json:"store_id" binding:"required"`
		PhoneNumber       string      `json:"phone_number" binding:"required"`
		Amount            float64     `json:"amount" binding:"required,min=1"`
		ExternalReference string      `json:"external_reference"`
		Metadata          interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get store mpesa settings
	var mpesaEnabled bool
	var mpesaStatus, mpesaApiKey string
	err := db.QueryRow(
		`SELECT mpesa_enabled, COALESCE(mpesa_status,''), COALESCE(mpesa_api_key,'')
		 FROM stores WHERE id=$1`, req.StoreID,
	).Scan(&mpesaEnabled, &mpesaStatus, &mpesaApiKey)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "store not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch store"})
		return
	}
	if !mpesaEnabled || mpesaStatus != "approved" || mpesaApiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "M-Pesa payments not enabled for this store"})
		return
	}

	// Format phone
	formattedPhone, err := formatKenyanPhone(req.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate external reference
	extRef := req.ExternalReference
	if extRef == "" {
		extRef = fmt.Sprintf("order_%d_%s", time.Now().UnixMilli(), randStr(8))
	}

	// Build callback URL
	callbackURL := getEnv("PAYMENT_CALLBACK_URL",
		fmt.Sprintf("http://localhost:%s/payments/mpesa/callback", getEnv("PORT", "8085")))

	// Build payload
	payload := map[string]interface{}{
		"phone_number":       formattedPhone,
		"amount":             int(req.Amount),
		"external_reference": extRef,
		"callback_url":       callbackURL,
	}
	body, _ := json.Marshal(payload)

	// Call Lipia API
	httpReq, _ := http.NewRequest("POST", lipiaBaseURL+"/payments/stk-push", bytes.NewReader(body))
	httpReq.Header.Set("Authorization", "Bearer "+mpesaApiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("Lipia API error: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "payment gateway unreachable"})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var lipiaResp map[string]interface{}
	json.Unmarshal(respBody, &lipiaResp)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("Lipia API response %d: %s", resp.StatusCode, string(respBody))
		c.JSON(http.StatusBadGateway, gin.H{"error": "payment initiation failed", "details": lipiaResp})
		return
	}

	// Extract transaction reference
	transRef := ""
	if data, ok := lipiaResp["data"].(map[string]interface{}); ok {
		if ref, ok := data["TransactionReference"].(string); ok {
			transRef = ref
		}
	}

	// Store payment request
	metaJSON, _ := json.Marshal(req.Metadata)
	var paymentID, createdAt string
	db.QueryRow(
		`INSERT INTO mpesa_payment_requests
			(store_id, user_id, phone_number, amount, external_reference, transaction_reference, status, metadata)
		 VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
		 RETURNING id, created_at`,
		req.StoreID, nullStr(userID), formattedPhone, req.Amount, extRef,
		nullStr(transRef), metaJSON,
	).Scan(&paymentID, &createdAt)

	c.JSON(http.StatusOK, gin.H{
		"success":               true,
		"payment_id":            paymentID,
		"external_reference":    extRef,
		"transaction_reference": transRef,
		"message":               "STK push sent. Enter your M-Pesa PIN.",
	})
}

// POST /payments/mpesa/status
func handleCheckMpesaStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		TransactionReference string `json:"transaction_reference"`
		ExternalReference    string `json:"external_reference"`
		StoreID              string `json:"store_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// First check our DB
	var status, extRef string
	var receiptNumber, resultDesc *string
	query := ""
	var args []interface{}

	if req.ExternalReference != "" {
		query = `SELECT status, external_reference, mpesa_receipt_number, result_desc
				 FROM mpesa_payment_requests WHERE external_reference=$1 AND user_id=$2`
		args = []interface{}{req.ExternalReference, userID}
	} else if req.TransactionReference != "" {
		query = `SELECT status, external_reference, mpesa_receipt_number, result_desc
				 FROM mpesa_payment_requests WHERE transaction_reference=$1 AND user_id=$2`
		args = []interface{}{req.TransactionReference, userID}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide external_reference or transaction_reference"})
		return
	}

	err := db.QueryRow(query, args...).Scan(&status, &extRef, &receiptNumber, &resultDesc)
	if err == nil && status == "success" {
		c.JSON(http.StatusOK, gin.H{
			"status":               "success",
			"external_reference":   extRef,
			"mpesa_receipt_number": receiptNumber,
		})
		return
	}

	// If pending, query Lipia for real-time status
	if req.StoreID != "" && req.TransactionReference != "" {
		var mpesaApiKey string
		db.QueryRow("SELECT COALESCE(mpesa_api_key,'') FROM stores WHERE id=$1", req.StoreID).Scan(&mpesaApiKey)

		if mpesaApiKey != "" {
			checkURL := fmt.Sprintf("%s/payments/check-status/%s", lipiaBaseURL, req.TransactionReference)
			httpReq, _ := http.NewRequest("GET", checkURL, nil)
			httpReq.Header.Set("Authorization", "Bearer "+mpesaApiKey)

			client := &http.Client{Timeout: 15 * time.Second}
			resp, err := client.Do(httpReq)
			if err == nil {
				defer resp.Body.Close()
				var lipiaResp map[string]interface{}
				json.NewDecoder(resp.Body).Decode(&lipiaResp)
				c.JSON(http.StatusOK, gin.H{"status": status, "lipia_response": lipiaResp})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": status, "external_reference": extRef})
}

// POST /payments/mpesa/callback (called by Lipia)
func handleMpesaCallback(c *gin.Context) {
	var callbackData struct {
		Status   bool `json:"status"`
		Response struct {
			Status               string `json:"Status"`
			ExternalReference    string `json:"ExternalReference"`
			MpesaReceiptNumber   string `json:"MpesaReceiptNumber"`
			ResultDesc           string `json:"ResultDesc"`
			TransactionReference string `json:"TransactionReference"`
		} `json:"response"`
	}
	if err := c.ShouldBindJSON(&callbackData); err != nil {
		log.Printf("M-Pesa callback parse error: %v", err)
		c.String(http.StatusOK, "ok")
		return
	}

	log.Printf("M-Pesa callback: status=%v ref=%s receipt=%s",
		callbackData.Status, callbackData.Response.ExternalReference,
		callbackData.Response.MpesaReceiptNumber)

	paymentStatus := "failed"
	if callbackData.Status && strings.EqualFold(callbackData.Response.Status, "success") {
		paymentStatus = "success"
	}

	extRef := callbackData.Response.ExternalReference
	if extRef != "" {
		db.Exec(`
			UPDATE mpesa_payment_requests SET
				status=$1,
				mpesa_receipt_number=NULLIF($2,''),
				result_desc=NULLIF($3,''),
				updated_at=NOW()
			WHERE external_reference=$4`,
			paymentStatus,
			callbackData.Response.MpesaReceiptNumber,
			callbackData.Response.ResultDesc,
			extRef,
		)
	}

	c.String(http.StatusOK, "ok")
}

// GET /payments/history
func handlePaymentHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, err := db.Query(`
		SELECT id, store_id, user_id, phone_number, amount, external_reference,
			   transaction_reference, mpesa_receipt_number, status, result_desc, created_at
		FROM mpesa_payment_requests
		WHERE user_id=$1
		ORDER BY created_at DESC
		LIMIT 50`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch payment history"})
		return
	}
	defer rows.Close()

	var payments []PaymentRequest
	for rows.Next() {
		var p PaymentRequest
		rows.Scan(
			&p.ID, &p.StoreID, &p.UserID, &p.PhoneNumber, &p.Amount,
			&p.ExternalReference, &p.TransactionRef, &p.MpesaReceiptNumber,
			&p.Status, &p.ResultDesc, &p.CreatedAt,
		)
		payments = append(payments, p)
	}
	if payments == nil {
		payments = []PaymentRequest{}
	}
	c.JSON(http.StatusOK, gin.H{"payments": payments})
}

// GET /payments/store/:store_id/history (for seller dashboard)
func handleStorePaymentHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("store_id")

	// Verify ownership
	var ownerID string
	db.QueryRow("SELECT owner_id FROM stores WHERE id=$1", storeID).Scan(&ownerID)
	role := c.GetString("role")
	if ownerID != userID && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}

	rows, err := db.Query(`
		SELECT id, store_id, user_id, phone_number, amount, external_reference,
			   transaction_reference, mpesa_receipt_number, status, result_desc, created_at
		FROM mpesa_payment_requests
		WHERE store_id=$1
		ORDER BY created_at DESC
		LIMIT 100`, storeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch payment history"})
		return
	}
	defer rows.Close()

	var payments []PaymentRequest
	for rows.Next() {
		var p PaymentRequest
		rows.Scan(
			&p.ID, &p.StoreID, &p.UserID, &p.PhoneNumber, &p.Amount,
			&p.ExternalReference, &p.TransactionRef, &p.MpesaReceiptNumber,
			&p.Status, &p.ResultDesc, &p.CreatedAt,
		)
		payments = append(payments, p)
	}
	if payments == nil {
		payments = []PaymentRequest{}
	}
	c.JSON(http.StatusOK, gin.H{"payments": payments})
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func randStr(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	initDB()

	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// Webhook callback — no auth needed
	r.POST("/payments/mpesa/callback", handleMpesaCallback)

	// Authenticated routes
	auth := r.Group("/payments")
	auth.Use(authMiddleware())
	{
		auth.POST("/mpesa/initiate", handleInitiateMpesa)
		auth.POST("/mpesa/status", handleCheckMpesaStatus)
		auth.GET("/history", handlePaymentHistory)
		auth.GET("/store/:store_id/history", handleStorePaymentHistory)
	}

	port := getEnv("PORT", "8085")
	log.Printf("Payment service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
