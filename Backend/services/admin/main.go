package main

import (
	"database/sql"
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
	log.Println("Admin service: DB connected")
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

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

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
		c.Set("role", claims.Role)
		c.Next()
	}
}

func adminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Next()
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// GET /admin/stats
func handleStats(c *gin.Context) {
	var userCount, storeCount, productCount, orderCount int
	db.QueryRow("SELECT COUNT(*) FROM profiles").Scan(&userCount)
	db.QueryRow("SELECT COUNT(*) FROM stores").Scan(&storeCount)
	db.QueryRow("SELECT COUNT(*) FROM products").Scan(&productCount)
	db.QueryRow("SELECT COUNT(*) FROM orders").Scan(&orderCount)

	var totalRevenue float64
	db.QueryRow("SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='delivered'").Scan(&totalRevenue)

	c.JSON(http.StatusOK, gin.H{
		"users":         userCount,
		"stores":        storeCount,
		"products":      productCount,
		"orders":        orderCount,
		"total_revenue": totalRevenue,
	})
}

// GET /admin/stores
func handleListStores(c *gin.Context) {
	rows, err := db.Query(`
		SELECT s.id, s.name, s.owner_id, p.email, s.location, s.is_active,
			   s.mpesa_enabled, s.mpesa_status, s.mpesa_type, s.mpesa_number,
			   s.mpesa_account_number, s.mpesa_bank_name, s.mpesa_api_key,
			   s.created_at
		FROM stores s
		LEFT JOIN profiles p ON s.owner_id = p.id
		ORDER BY s.created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch stores"})
		return
	}
	defer rows.Close()

	var stores []map[string]interface{}
	for rows.Next() {
		var id, ownerID, createdAt string
		var name, ownerEmail, location, mpesaStatus, mpesaType, mpesaNumber, mpesaAccountNum, mpesaBankName, mpesaApiKey *string
		var isActive, mpesaEnabled bool
		err := rows.Scan(&id, &name, &ownerID, &ownerEmail, &location, &isActive,
			&mpesaEnabled, &mpesaStatus, &mpesaType, &mpesaNumber,
			&mpesaAccountNum, &mpesaBankName, &mpesaApiKey, &createdAt)
		if err != nil {
			continue
		}
		stores = append(stores, map[string]interface{}{
			"id": id, "name": name, "owner_id": ownerID, "owner_email": ownerEmail,
			"location": location, "is_active": isActive,
			"mpesa_enabled": mpesaEnabled, "mpesa_status": mpesaStatus,
			"mpesa_type": mpesaType, "mpesa_number": mpesaNumber,
			"mpesa_account_number": mpesaAccountNum, "mpesa_bank_name": mpesaBankName,
			"mpesa_api_key": mpesaApiKey, "created_at": createdAt,
		})
	}
	if stores == nil {
		stores = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"stores": stores})
}

// DELETE /admin/stores/:id
func handleDeleteStore(c *gin.Context) {
	storeID := c.Param("id")
	db.Exec("DELETE FROM stores WHERE id=$1", storeID)
	c.JSON(http.StatusOK, gin.H{"message": "store deleted"})
}

// PATCH /admin/stores/:id/activate
func handleToggleStoreActive(c *gin.Context) {
	storeID := c.Param("id")
	var req struct {
		IsActive bool `json:"is_active"`
	}
	c.ShouldBindJSON(&req)
	db.Exec("UPDATE stores SET is_active=$1, updated_at=NOW() WHERE id=$2", req.IsActive, storeID)
	c.JSON(http.StatusOK, gin.H{"message": "store updated"})
}

// ─── M-Pesa Approval ─────────────────────────────────────────────────────────

// GET /admin/mpesa/pending
func handleMpesaPending(c *gin.Context) {
	rows, err := db.Query(`
		SELECT s.id, s.name, s.mpesa_type, s.mpesa_number, s.mpesa_account_number,
			   s.mpesa_bank_name, s.mpesa_api_key, s.mpesa_status, s.created_at,
			   p.email
		FROM stores s
		LEFT JOIN profiles p ON s.owner_id = p.id
		WHERE s.mpesa_enabled=true AND (s.mpesa_status='pending' OR s.mpesa_status IS NULL)
		ORDER BY s.created_at ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pending stores"})
		return
	}
	defer rows.Close()

	var stores []map[string]interface{}
	for rows.Next() {
		var id, createdAt string
		var name, mpesaType, mpesaNumber, mpesaAccountNum, mpesaBankName, mpesaApiKey, mpesaStatus, ownerEmail *string
		rows.Scan(&id, &name, &mpesaType, &mpesaNumber, &mpesaAccountNum,
			&mpesaBankName, &mpesaApiKey, &mpesaStatus, &createdAt, &ownerEmail)
		stores = append(stores, map[string]interface{}{
			"id": id, "name": name, "mpesa_type": mpesaType, "mpesa_number": mpesaNumber,
			"mpesa_account_number": mpesaAccountNum, "mpesa_bank_name": mpesaBankName,
			"mpesa_api_key": mpesaApiKey, "mpesa_status": mpesaStatus,
			"created_at": createdAt, "owner_email": ownerEmail,
		})
	}
	if stores == nil {
		stores = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"stores": stores})
}

// PUT /admin/mpesa/:store_id/approve
func handleApproveMpesa(c *gin.Context) {
	storeID := c.Param("store_id")
	var req struct {
		ApiKey string `json:"api_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db.Exec(`
		UPDATE stores SET
			mpesa_status='approved',
			mpesa_api_key=$1,
			mpesa_approved_at=NOW(),
			updated_at=NOW()
		WHERE id=$2`, req.ApiKey, storeID)
	c.JSON(http.StatusOK, gin.H{"message": "M-Pesa approved"})
}

// PUT /admin/mpesa/:store_id/reject
func handleRejectMpesa(c *gin.Context) {
	storeID := c.Param("store_id")
	db.Exec(`
		UPDATE stores SET
			mpesa_status='rejected',
			mpesa_api_key=NULL,
			updated_at=NOW()
		WHERE id=$1`, storeID)
	c.JSON(http.StatusOK, gin.H{"message": "M-Pesa rejected"})
}

// ─── Products Management ─────────────────────────────────────────────────────

// GET /admin/products
func handleListProducts(c *gin.Context) {
	rows, err := db.Query(`
		SELECT p.id, p.name, p.price, p.image_url, p.store_id, s.name, p.created_at
		FROM products p
		LEFT JOIN stores s ON p.store_id = s.id
		ORDER BY p.created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch products"})
		return
	}
	defer rows.Close()

	var products []map[string]interface{}
	for rows.Next() {
		var id, createdAt string
		var name, imageURL, storeID, storeName *string
		var price *float64
		rows.Scan(&id, &name, &price, &imageURL, &storeID, &storeName, &createdAt)
		products = append(products, map[string]interface{}{
			"id": id, "name": name, "price": price, "image_url": imageURL,
			"store_id": storeID, "store_name": storeName, "created_at": createdAt,
		})
	}
	if products == nil {
		products = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"products": products})
}

// DELETE /admin/products/:id
func handleDeleteProduct(c *gin.Context) {
	productID := c.Param("id")
	db.Exec("DELETE FROM products WHERE id=$1", productID)
	c.JSON(http.StatusOK, gin.H{"message": "product deleted"})
}

// ─── Admin Settings (Featured / Top Selling) ─────────────────────────────────

// GET /admin/settings/:key
func handleGetSetting(c *gin.Context) {
	key := c.Param("key")
	var value []byte
	err := db.QueryRow("SELECT setting_value FROM admin_settings WHERE setting_key=$1", key).Scan(&value)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "setting not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch setting"})
		return
	}
	var parsed interface{}
	json.Unmarshal(value, &parsed)
	c.JSON(http.StatusOK, gin.H{"key": key, "value": parsed})
}

// PUT /admin/settings/:key
func handleUpsertSetting(c *gin.Context) {
	key := c.Param("key")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	value, _ := json.Marshal(body)
	_, err := db.Exec(`
		INSERT INTO admin_settings (setting_key, setting_value)
		VALUES ($1, $2)
		ON CONFLICT (setting_key) DO UPDATE SET setting_value=$2, updated_at=NOW()`,
		key, value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save setting"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "setting saved"})
}

// ─── Users ───────────────────────────────────────────────────────────────────

// GET /admin/users
func handleListUsers(c *gin.Context) {
	rows, err := db.Query(`
		SELECT id, email, full_name, role, user_type, created_at
		FROM profiles ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id, email, role, userType, createdAt string
		var fullName *string
		rows.Scan(&id, &email, &fullName, &role, &userType, &createdAt)
		users = append(users, map[string]interface{}{
			"id": id, "email": email, "full_name": fullName,
			"role": role, "user_type": userType, "created_at": createdAt,
		})
	}
	if users == nil {
		users = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

// DELETE /admin/users/:id
func handleDeleteUser(c *gin.Context) {
	userID := c.Param("id")
	db.Exec("DELETE FROM profiles WHERE id=$1", userID)
	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}

// PUT /admin/users/:id/role
func handleUpdateUserRole(c *gin.Context) {
	targetID := c.Param("id")
	var req struct {
		Role     string `json:"role"`
		UserType string `json:"user_type"`
	}
	c.ShouldBindJSON(&req)
	if req.Role != "" {
		db.Exec("UPDATE profiles SET role=$1, updated_at=NOW() WHERE id=$2", req.Role, targetID)
	}
	if req.UserType != "" {
		db.Exec("UPDATE profiles SET user_type=$1, updated_at=NOW() WHERE id=$2", req.UserType, targetID)
	}
	c.JSON(http.StatusOK, gin.H{"message": "user updated"})
}

// GET /admin/complaints
func handleListComplaints(c *gin.Context) {
	rows, err := db.Query(`
		SELECT c.id, c.message, c.submitted_at, c.store_id, s.name
		FROM complaints c
		LEFT JOIN stores s ON c.store_id = s.id
		ORDER BY c.submitted_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch complaints"})
		return
	}
	defer rows.Close()

	var complaints []map[string]interface{}
	for rows.Next() {
		var id, submittedAt string
		var message, storeID, storeName *string
		rows.Scan(&id, &message, &submittedAt, &storeID, &storeName)
		complaints = append(complaints, map[string]interface{}{
			"id": id, "message": message, "submitted_at": submittedAt,
			"store_id": storeID, "store_name": storeName,
		})
	}
	if complaints == nil {
		complaints = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"complaints": complaints})
}

// DELETE /admin/complaints/:id
func handleDeleteComplaint(c *gin.Context) {
	cID := c.Param("id")
	db.Exec("DELETE FROM complaints WHERE id=$1", cID)
	c.JSON(http.StatusOK, gin.H{"message": "complaint deleted"})
}

// ─── Make Admin Endpoint (first admin setup) ─────────────────────────────────

// POST /admin/promote
func handlePromoteAdmin(c *gin.Context) {
	var req struct {
		Email      string `json:"email" binding:"required"`
		AdminToken string `json:"admin_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expected := getEnv("ADMIN_SETUP_TOKEN", "setup-admin-token-change-this")
	if req.AdminToken != expected {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid admin token"})
		return
	}

	result, err := db.Exec("UPDATE profiles SET role='admin', updated_at=NOW() WHERE email=$1", req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to promote user"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user promoted to admin"})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	initDB()

	r := gin.Default()
	r.Use(corsMiddleware())

	// Health check
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// First-run admin setup (no auth)
	r.POST("/admin/promote", handlePromoteAdmin)

	// Admin-only routes
	admin := r.Group("/admin")
	admin.Use(authMiddleware(), adminRequired())
	{
		admin.GET("/stats", handleStats)

		// Stores
		admin.GET("/stores", handleListStores)
		admin.DELETE("/stores/:id", handleDeleteStore)
		admin.PATCH("/stores/:id/activate", handleToggleStoreActive)

		// M-Pesa approvals
		admin.GET("/mpesa/pending", handleMpesaPending)
		admin.PUT("/mpesa/:store_id/approve", handleApproveMpesa)
		admin.PUT("/mpesa/:store_id/reject", handleRejectMpesa)

		// Products
		admin.GET("/products", handleListProducts)
		admin.DELETE("/products/:id", handleDeleteProduct)

		// Settings
		admin.GET("/settings/:key", handleGetSetting)
		admin.PUT("/settings/:key", handleUpsertSetting)

		// Users
		admin.GET("/users", handleListUsers)
		admin.DELETE("/users/:id", handleDeleteUser)
		admin.PUT("/users/:id/role", handleUpdateUserRole)

		// Complaints
		admin.GET("/complaints", handleListComplaints)
		admin.DELETE("/complaints/:id", handleDeleteComplaint)
	}

	port := getEnv("PORT", "8086")
	log.Printf("Admin service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
