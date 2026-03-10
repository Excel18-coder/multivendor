package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

// ─── Models ──────────────────────────────────────────────────────────────────

type Store struct {
	ID              UUID    `json:"id"`
	OwnerID         *UUID   `json:"owner_id,omitempty"`
	Name            *string `json:"name"`
	Description     *string `json:"description"`
	Location        *string `json:"location"`
	ImageURL        *string `json:"image_url"`
	Slug            *string `json:"slug"`
	StoreType       *string `json:"store_type"`
	PaymentOptions  StrArr  `json:"payment_options"`
	IsActive        bool    `json:"is_active"`
	DeliveryFee     float64 `json:"delivery_fee"`
	WhatsappPhone   *string `json:"whatsapp_phone"`
	MpesaEnabled    bool    `json:"mpesa_enabled"`
	MpesaType       *string `json:"mpesa_type,omitempty"`
	MpesaNumber     *string `json:"mpesa_number,omitempty"`
	MpesaAccountNum *string `json:"mpesa_account_number,omitempty"`
	MpesaBankName   *string `json:"mpesa_bank_name,omitempty"`
	MpesaStatus     *string `json:"mpesa_status"`
	MpesaApprovedAt *string `json:"mpesa_approved_at,omitempty"`
	CreatedAt       string  `json:"created_at"`
}

type UUID = string
type StrArr []string

func (s *StrArr) Scan(value interface{}) error {
	if value == nil {
		*s = []string{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		str, ok2 := value.(string)
		if !ok2 {
			return nil
		}
		bytes = []byte(str)
	}
	str := string(bytes)
	str = strings.Trim(str, "{}")
	if str == "" {
		*s = []string{}
		return nil
	}
	parts := strings.Split(str, ",")
	for i, p := range parts {
		parts[i] = strings.Trim(p, `"`)
	}
	*s = parts
	return nil
}

type Complaint struct {
	ID          string  `json:"id"`
	UserID      *string `json:"user_id"`
	StoreID     string  `json:"store_id"`
	Message     *string `json:"message"`
	SubmittedAt string  `json:"submitted_at"`
}

type Rating struct {
	ID        string  `json:"id"`
	BuyerID   *string `json:"buyer_id"`
	StoreID   string  `json:"store_id"`
	Rating    float64 `json:"rating"`
	Comment   *string `json:"comment"`
	CreatedAt string  `json:"created_at"`
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
	db.SetMaxOpenConns(25)
	log.Println("Store service: DB connected")
}

func getEnv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}

// ─── JWT (mirrors auth service) ──────────────────────────────────────────────

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

// ─── Store Helpers ───────────────────────────────────────────────────────────

// stripBase64FromStore replaces inline base64 image_url with a path-based reference.
func stripBase64FromStore(s *Store) {
	if s.ImageURL != nil && strings.HasPrefix(*s.ImageURL, "data:") {
		path := fmt.Sprintf("/stores/%s/image", s.ID)
		s.ImageURL = &path
	}
}

// GET /stores/:slug/image — serves the raw binary image stored as base64 in the DB
func handleStoreImage(c *gin.Context) {
	storeID := c.Param("slug")
	var imgURL sql.NullString
	err := db.QueryRow("SELECT image_url FROM stores WHERE id=$1", storeID).Scan(&imgURL)
	if err == sql.ErrNoRows {
		c.Status(http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Store image fetch error: %v", err)
		c.Status(http.StatusInternalServerError)
		return
	}
	if !imgURL.Valid || imgURL.String == "" {
		c.Status(http.StatusNotFound)
		return
	}
	imgStr := imgURL.String
	if !strings.HasPrefix(imgStr, "data:") {
		c.Redirect(http.StatusFound, imgStr)
		return
	}
	comma := strings.Index(imgStr, ",")
	if comma < 0 {
		c.Status(http.StatusInternalServerError)
		return
	}
	meta := imgStr[5:comma]
	b64data := imgStr[comma+1:]
	contentType := "image/jpeg"
	if idx := strings.Index(meta, ";"); idx > 0 {
		contentType = meta[:idx]
	}
	imgBytes, err := base64.StdEncoding.DecodeString(b64data)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, contentType, imgBytes)
}

// ─── Store Handlers ───────────────────────────────────────────────────────────

func scanStore(row interface{ Scan(...interface{}) error }) (*Store, error) {
	s := &Store{}
	var paymentOpts StrArr
	err := row.Scan(
		&s.ID, &s.OwnerID, &s.Name, &s.Description, &s.Location,
		&s.ImageURL, &s.Slug, &s.StoreType, &paymentOpts,
		&s.IsActive, &s.DeliveryFee, &s.WhatsappPhone,
		&s.MpesaEnabled, &s.MpesaType, &s.MpesaNumber,
		&s.MpesaAccountNum, &s.MpesaBankName, &s.MpesaStatus, &s.MpesaApprovedAt,
		&s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	s.PaymentOptions = paymentOpts
	return s, nil
}

const storeSelectCols = `
	id, owner_id, name, description, location, image_url, slug, store_type,
	payment_options, is_active, delivery_fee, whatsapp_phone,
	mpesa_enabled, mpesa_type, mpesa_number, mpesa_account_number,
	mpesa_bank_name, mpesa_status, mpesa_approved_at, created_at`

// GET /stores
func handleListStores(c *gin.Context) {
	where := []string{"is_active=true"}
	args := []interface{}{}
	idx := 1

	if storeType := c.Query("store_type"); storeType != "" {
		where = append(where, fmt.Sprintf("store_type ILIKE $%d", idx))
		args = append(args, "%"+storeType+"%")
		idx++
	}
	if search := c.Query("search"); search != "" {
		where = append(where, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d)", idx, idx))
		args = append(args, "%"+search+"%")
		idx++
	}

	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		fmt.Sscan(l, &limit)
	}
	if o := c.Query("offset"); o != "" {
		fmt.Sscan(o, &offset)
	}

	query := fmt.Sprintf(
		`SELECT `+storeSelectCols+` FROM stores WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		strings.Join(where, " AND "), idx, idx+1,
	)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch stores"})
		return
	}
	defer rows.Close()

	var stores []*Store
	for rows.Next() {
		s, err := scanStore(rows)
		if err != nil {
			continue
		}
		stripBase64FromStore(s)
		stores = append(stores, s)
	}
	if stores == nil {
		stores = []*Store{}
	}
	c.JSON(http.StatusOK, gin.H{"stores": stores})
}

// GET /stores/:slug
func handleGetStore(c *gin.Context) {
	slug := c.Param("slug")
	row := db.QueryRow(`SELECT `+storeSelectCols+` FROM stores WHERE slug=$1 OR id=$1`, slug)
	s, err := scanStore(row)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "store not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch store"})
		return
	}

	// Attach computed stats
	var productCount, followerCount int
	var avgRating float64
	db.QueryRow("SELECT COUNT(*) FROM products WHERE store_id=$1", s.ID).Scan(&productCount)
	db.QueryRow("SELECT COUNT(*) FROM store_follows WHERE store_id=$1", s.ID).Scan(&followerCount)
	db.QueryRow("SELECT COALESCE(calculate_store_rating($1), 3.0)", s.ID).Scan(&avgRating)
	stripBase64FromStore(s)
	c.JSON(http.StatusOK, gin.H{
		"store":          s,
		"product_count":  productCount,
		"follower_count": followerCount,
		"avg_rating":     avgRating,
	})
}

// POST /stores
func handleCreateStore(c *gin.Context) {
	userID := c.GetString("user_id")
	userType := c.GetString("user_type")
	if userType != "seller" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only sellers can create stores"})
		return
	}

	// Check if user already has a store
	var existingID string
	db.QueryRow("SELECT id FROM stores WHERE owner_id=$1", userID).Scan(&existingID)
	if existingID != "" {
		c.JSON(http.StatusConflict, gin.H{"error": "you already have a store"})
		return
	}

	var req struct {
		Name            string   `json:"name" binding:"required"`
		Description     string   `json:"description"`
		Location        string   `json:"location"`
		ImageURL        string   `json:"image_url"`
		StoreType       string   `json:"store_type"`
		PaymentOptions  []string `json:"payment_options"`
		DeliveryFee     float64  `json:"delivery_fee"`
		WhatsappPhone   string   `json:"whatsapp_phone"`
		MpesaEnabled    bool     `json:"mpesa_enabled"`
		MpesaType       string   `json:"mpesa_type"`
		MpesaNumber     string   `json:"mpesa_number"`
		MpesaAccountNum string   `json:"mpesa_account_number"`
		MpesaBankName   string   `json:"mpesa_bank_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.PaymentOptions) == 0 {
		req.PaymentOptions = []string{"POD"}
	}

	// Generate slug
	var slug string
	db.QueryRow("SELECT generate_store_slug($1)", req.Name).Scan(&slug)

	payOpts, _ := json.Marshal(req.PaymentOptions)
	payOptsStr := "{" + strings.Join(req.PaymentOptions, ",") + "}"

	s := &Store{}
	err := db.QueryRow(`
		INSERT INTO stores (owner_id, name, description, location, image_url, slug,
			store_type, payment_options, delivery_fee, whatsapp_phone,
			mpesa_enabled, mpesa_type, mpesa_number, mpesa_account_number, mpesa_bank_name,
			mpesa_status, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',true)
		RETURNING `+storeSelectCols,
		userID, req.Name, nullStr(req.Description), nullStr(req.Location),
		nullStr(req.ImageURL), slug, nullStr(req.StoreType),
		payOptsStr, req.DeliveryFee, nullStr(req.WhatsappPhone),
		req.MpesaEnabled, nullStr(req.MpesaType), nullStr(req.MpesaNumber),
		nullStr(req.MpesaAccountNum), nullStr(req.MpesaBankName),
	).Scan(
		&s.ID, &s.OwnerID, &s.Name, &s.Description, &s.Location,
		&s.ImageURL, &s.Slug, &s.StoreType, (*StrArr)(&s.PaymentOptions),
		&s.IsActive, &s.DeliveryFee, &s.WhatsappPhone,
		&s.MpesaEnabled, &s.MpesaType, &s.MpesaNumber,
		&s.MpesaAccountNum, &s.MpesaBankName, &s.MpesaStatus, &s.MpesaApprovedAt,
		&s.CreatedAt,
	)
	_ = payOpts
	if err != nil {
		log.Printf("Create store error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create store"})
		return
	}
	stripBase64FromStore(s)
	c.JSON(http.StatusCreated, gin.H{"store": s})
}

// PUT /stores/:id
func handleUpdateStore(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("slug")

	var ownerID string
	db.QueryRow("SELECT owner_id FROM stores WHERE id=$1", storeID).Scan(&ownerID)
	if ownerID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "store not found"})
		return
	}
	role := c.GetString("role")
	if ownerID != userID && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}

	var req struct {
		Name            string   `json:"name"`
		Description     string   `json:"description"`
		Location        string   `json:"location"`
		ImageURL        string   `json:"image_url"`
		StoreType       string   `json:"store_type"`
		PaymentOptions  []string `json:"payment_options"`
		DeliveryFee     *float64 `json:"delivery_fee"`
		WhatsappPhone   string   `json:"whatsapp_phone"`
		MpesaEnabled    *bool    `json:"mpesa_enabled"`
		MpesaType       string   `json:"mpesa_type"`
		MpesaNumber     string   `json:"mpesa_number"`
		MpesaAccountNum string   `json:"mpesa_account_number"`
		MpesaBankName   string   `json:"mpesa_bank_name"`
		MpesaApiKey     string   `json:"mpesa_api_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	payOptsStr := ""
	if len(req.PaymentOptions) > 0 {
		payOptsStr = "{" + strings.Join(req.PaymentOptions, ",") + "}"
	}

	_, err := db.Exec(`
		UPDATE stores SET
			name              = CASE WHEN $2='' THEN name ELSE $2 END,
			description       = CASE WHEN $3='' THEN description ELSE $3 END,
			location          = CASE WHEN $4='' THEN location ELSE $4 END,
			image_url         = CASE WHEN $5='' THEN image_url ELSE $5 END,
			store_type        = CASE WHEN $6='' THEN store_type ELSE $6 END,
			payment_options   = CASE WHEN $7='' THEN payment_options ELSE $7::text[] END,
			delivery_fee      = COALESCE($8, delivery_fee),
			whatsapp_phone    = CASE WHEN $9='' THEN whatsapp_phone ELSE $9 END,
			mpesa_enabled     = COALESCE($10, mpesa_enabled),
			mpesa_type        = CASE WHEN $11='' THEN mpesa_type ELSE $11 END,
			mpesa_number      = CASE WHEN $12='' THEN mpesa_number ELSE $12 END,
			mpesa_account_number = CASE WHEN $13='' THEN mpesa_account_number ELSE $13 END,
			mpesa_bank_name   = CASE WHEN $14='' THEN mpesa_bank_name ELSE $14 END,
			mpesa_api_key     = CASE WHEN $15='' THEN mpesa_api_key ELSE $15 END,
			updated_at        = NOW()
		WHERE id=$1`,
		storeID, req.Name, req.Description, req.Location, req.ImageURL,
		req.StoreType, payOptsStr, req.DeliveryFee, req.WhatsappPhone,
		req.MpesaEnabled, req.MpesaType, req.MpesaNumber,
		req.MpesaAccountNum, req.MpesaBankName, req.MpesaApiKey,
	)
	if err != nil {
		log.Printf("Update store error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update store"})
		return
	}

	row := db.QueryRow(`SELECT `+storeSelectCols+` FROM stores WHERE id=$1`, storeID)
	s, err := scanStore(row)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch updated store"})
		return
	}
	stripBase64FromStore(s)
	c.JSON(http.StatusOK, gin.H{"store": s})
}

// DELETE /stores/:id
func handleDeleteStore(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("slug")
	role := c.GetString("role")

	var ownerID string
	db.QueryRow("SELECT owner_id FROM stores WHERE id=$1", storeID).Scan(&ownerID)
	if ownerID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "store not found"})
		return
	}
	if ownerID != userID && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}

	db.Exec("DELETE FROM stores WHERE id=$1", storeID)
	c.JSON(http.StatusOK, gin.H{"message": "store deleted"})
}

// GET /stores/:id/my — get current user's store
func handleGetMyStore(c *gin.Context) {
	userID := c.GetString("user_id")
	row := db.QueryRow(`SELECT `+storeSelectCols+` FROM stores WHERE owner_id=$1`, userID)
	s, err := scanStore(row)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"store": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch store"})
		return
	}
	stripBase64FromStore(s)
	c.JSON(http.StatusOK, gin.H{"store": s})
}

// ─── Follow Handlers ──────────────────────────────────────────────────────────

// POST /stores/:id/follow
func handleFollowStore(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("slug")
	_, err := db.Exec(
		`INSERT INTO store_follows (user_id, store_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
		userID, storeID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to follow store"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "following store"})
}

// DELETE /stores/:id/follow
func handleUnfollowStore(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("slug")
	db.Exec("DELETE FROM store_follows WHERE user_id=$1 AND store_id=$2", userID, storeID)
	c.JSON(http.StatusOK, gin.H{"message": "unfollowed store"})
}

// GET /stores/:id/follow/status
func handleFollowStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("slug")
	var count int
	db.QueryRow("SELECT COUNT(*) FROM store_follows WHERE user_id=$1 AND store_id=$2", userID, storeID).Scan(&count)
	c.JSON(http.StatusOK, gin.H{"following": count > 0})
}

// GET /stores/:id/followers
func handleGetFollowers(c *gin.Context) {
	storeID := c.Param("slug")
	var count int
	db.QueryRow("SELECT COUNT(*) FROM store_follows WHERE store_id=$1", storeID).Scan(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ─── Rating Handlers ──────────────────────────────────────────────────────────

// GET /stores/:id/ratings
func handleGetRatings(c *gin.Context) {
	storeID := c.Param("slug")
	rows, err := db.Query(
		`SELECT id, buyer_id, store_id, rating, comment, created_at
		 FROM ratings WHERE store_id=$1 ORDER BY created_at DESC`, storeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch ratings"})
		return
	}
	defer rows.Close()
	var ratings []Rating
	for rows.Next() {
		var r Rating
		rows.Scan(&r.ID, &r.BuyerID, &r.StoreID, &r.Rating, &r.Comment, &r.CreatedAt)
		ratings = append(ratings, r)
	}
	if ratings == nil {
		ratings = []Rating{}
	}

	var avg float64
	db.QueryRow("SELECT COALESCE(calculate_store_rating($1), 3.0)", storeID).Scan(&avg)
	c.JSON(http.StatusOK, gin.H{"ratings": ratings, "average": avg})
}

// POST /stores/:id/ratings
func handleCreateRating(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("slug")
	var req struct {
		Rating  float64 `json:"rating" binding:"required,min=1,max=5"`
		Comment string  `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var id, createdAt string
	err := db.QueryRow(
		`INSERT INTO ratings (buyer_id, store_id, rating, comment) VALUES ($1,$2,$3,$4)
		 RETURNING id, created_at`,
		userID, storeID, req.Rating, nullStr(req.Comment),
	).Scan(&id, &createdAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create rating"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "created_at": createdAt})
}

// ─── Complaint Handlers ───────────────────────────────────────────────────────

// GET /stores/:id/complaints
func handleGetComplaints(c *gin.Context) {
	storeID := c.Param("slug")
	rows, err := db.Query(
		`SELECT id, user_id, store_id, message, submitted_at
		 FROM complaints WHERE store_id=$1 ORDER BY submitted_at DESC`, storeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch complaints"})
		return
	}
	defer rows.Close()
	var complaints []Complaint
	for rows.Next() {
		var comp Complaint
		rows.Scan(&comp.ID, &comp.UserID, &comp.StoreID, &comp.Message, &comp.SubmittedAt)
		complaints = append(complaints, comp)
	}
	if complaints == nil {
		complaints = []Complaint{}
	}
	c.JSON(http.StatusOK, gin.H{"complaints": complaints})
}

// POST /stores/:id/complaints
func handleCreateComplaint(c *gin.Context) {
	userID := c.GetString("user_id")
	storeID := c.Param("slug")
	var req struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var id, submittedAt string
	err := db.QueryRow(
		`INSERT INTO complaints (user_id, store_id, message) VALUES ($1,$2,$3)
		 RETURNING id, submitted_at`,
		userID, storeID, req.Message,
	).Scan(&id, &submittedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create complaint"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "submitted_at": submittedAt})
}

// POST /complaints (with store_id in body)
func handleCreateComplaintGeneric(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		StoreID string `json:"store_id" binding:"required"`
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var id, submittedAt string
	err := db.QueryRow(
		`INSERT INTO complaints (user_id, store_id, message) VALUES ($1,$2,$3)
		 RETURNING id, submitted_at`,
		userID, req.StoreID, req.Message,
	).Scan(&id, &submittedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create complaint"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "submitted_at": submittedAt})
}

// ─── Helper ───────────────────────────────────────────────────────────────────

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	initDB()

	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// Public routes
	r.GET("/stores", handleListStores)
	// NOTE: /stores/me/store MUST be registered before /stores/:slug to avoid Gin
	// treating "me" as the :slug parameter.
	r.GET("/stores/me/store", authMiddleware(), handleGetMyStore)
	r.GET("/stores/:slug/image", handleStoreImage) // Serve binary images (must be before /:slug)
	r.GET("/stores/:slug", handleGetStore)
	r.GET("/stores/:slug/followers", handleGetFollowers)
	r.GET("/stores/:slug/ratings", handleGetRatings)
	r.GET("/stores/:slug/complaints", handleGetComplaints)

	// Authenticated routes
	auth := r.Group("/")
	auth.Use(authMiddleware())
	{
		auth.POST("/stores", handleCreateStore)
		auth.PUT("/stores/:slug", handleUpdateStore)
		auth.DELETE("/stores/:slug", handleDeleteStore)
		auth.POST("/stores/:slug/follow", handleFollowStore)
		auth.DELETE("/stores/:slug/follow", handleUnfollowStore)
		auth.GET("/stores/:slug/follow/status", handleFollowStatus)
		auth.POST("/stores/:slug/ratings", handleCreateRating)
		auth.POST("/stores/:slug/complaints", handleCreateComplaint)
		auth.POST("/complaints", handleCreateComplaintGeneric)
	}

	port := getEnv("PORT", "8082")
	log.Printf("Store service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
