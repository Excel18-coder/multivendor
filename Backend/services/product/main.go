package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

// ─── Models ──────────────────────────────────────────────────────────────────

type Product struct {
	ID                 string   `json:"id"`
	StoreID            *string  `json:"store_id"`
	StoreName          *string  `json:"store_name,omitempty"`
	StoreSlug          *string  `json:"store_slug,omitempty"`
	StoreWhatsappPhone *string  `json:"store_whatsapp_phone,omitempty"`
	StoreLocation      *string  `json:"store_location,omitempty"`
	StoreImageURL      *string  `json:"store_image_url,omitempty"`
	StoreMpesaEnabled  *bool    `json:"store_mpesa_enabled,omitempty"`
	StoreMpesaStatus   *string  `json:"store_mpesa_status,omitempty"`
	Name               *string  `json:"name"`
	Description        *string  `json:"description"`
	Price              *float64 `json:"price"`
	Category           *string  `json:"category"`
	Quality            *string  `json:"quality"`
	ImageURL           *string  `json:"image_url"`
	ImageURLs          StrArr   `json:"image_urls"`
	InStock            bool     `json:"in_stock"`
	Tags               StrArr   `json:"tags"`
	DiscountPercentage float64  `json:"discount_percentage"`
	CreatedAt          string   `json:"created_at"`
}

type StrArr []string

func (s *StrArr) Scan(value interface{}) error {
	if value == nil {
		*s = []string{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return nil
	}
	str := strings.Trim(string(bytes), "{}")
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
	log.Println("Product service: DB connected")
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
		c.Set("user_type", claims.UserType)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func strArrLiteral(arr []string) string {
	if len(arr) == 0 {
		return "{}"
	}
	quoted := make([]string, len(arr))
	for i, s := range arr {
		quoted[i] = `"` + strings.ReplaceAll(s, `"`, `\"`) + `"`
	}
	return "{" + strings.Join(quoted, ",") + "}"
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

func scanProduct(row interface{ Scan(...interface{}) error }, withStore bool) (*Product, error) {
	p := &Product{}
	var tags, imageURLs StrArr
	var err error
	if withStore {
		err = row.Scan(
			&p.ID, &p.StoreID, &p.Name, &p.Description, &p.Price, &p.Category,
			&p.Quality, &p.ImageURL, &imageURLs, &p.InStock, &tags,
			&p.DiscountPercentage, &p.CreatedAt,
			&p.StoreName, &p.StoreSlug, &p.StoreWhatsappPhone, &p.StoreLocation,
			&p.StoreImageURL, &p.StoreMpesaEnabled, &p.StoreMpesaStatus)
	} else {
		err = row.Scan(
			&p.ID, &p.StoreID, &p.Name, &p.Description, &p.Price, &p.Category,
			&p.Quality, &p.ImageURL, &imageURLs, &p.InStock, &tags,
			&p.DiscountPercentage, &p.CreatedAt,
		)
	}
	if err != nil {
		return nil, err
	}
	p.Tags = tags
	p.ImageURLs = imageURLs
	return p, nil
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// GET /products?in_stock=true&category=X&search=Y&store_id=Z&limit=N&offset=N
func handleListProducts(c *gin.Context) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if inStock := c.Query("in_stock"); inStock == "true" {
		where = append(where, fmt.Sprintf("p.in_stock=$%d", idx))
		args = append(args, true)
		idx++
	}
	if category := c.Query("category"); category != "" {
		where = append(where, fmt.Sprintf("p.category=$%d", idx))
		args = append(args, category)
		idx++
	}
	if storeID := c.Query("store_id"); storeID != "" {
		where = append(where, fmt.Sprintf("p.store_id=$%d", idx))
		args = append(args, storeID)
		idx++
	}
	if search := c.Query("search"); search != "" {
		where = append(where, fmt.Sprintf(
			"(p.name ILIKE $%d OR p.description ILIKE $%d OR p.category ILIKE $%d)",
			idx, idx, idx))
		args = append(args, "%"+search+"%")
		idx++
	}
	if hasDiscount := c.Query("has_discount"); hasDiscount == "true" {
		where = append(where, "p.discount_percentage > 0")
	}
	if ids := c.QueryArray("ids"); len(ids) > 0 {
		placeholders := make([]string, len(ids))
		for i, id := range ids {
			placeholders[i] = fmt.Sprintf("$%d", idx)
			args = append(args, id)
			idx++
		}
		where = append(where, "p.id IN ("+strings.Join(placeholders, ",")+")")
	}

	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		fmt.Sscan(l, &limit)
	}
	if o := c.Query("offset"); o != "" {
		fmt.Sscan(o, &offset)
	}

	query := fmt.Sprintf(`
		SELECT p.id, p.store_id, p.name, p.description, p.price, p.category,
			   p.quality, p.image_url, p.image_urls, p.in_stock, p.tags,
			   p.discount_percentage, p.created_at,
			   s.name, s.slug, s.whatsapp_phone, s.location,
			   s.image_url AS store_image_url, s.mpesa_enabled, s.mpesa_status
		FROM products p
		LEFT JOIN stores s ON p.store_id = s.id
		WHERE %s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d`,
		strings.Join(where, " AND "), idx, idx+1)

	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("List products error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch products"})
		return
	}
	defer rows.Close()

	var products []*Product
	for rows.Next() {
		p, err := scanProduct(rows, true)
		if err != nil {
			log.Printf("Scan product error: %v", err)
			continue
		}
		products = append(products, p)
	}
	if products == nil {
		products = []*Product{}
	}
	c.JSON(http.StatusOK, gin.H{"products": products})
}

// GET /products/:id
func handleGetProduct(c *gin.Context) {
	productID := c.Param("id")
	row := db.QueryRow(`
		SELECT p.id, p.store_id, p.name, p.description, p.price, p.category,
			   p.quality, p.image_url, p.image_urls, p.in_stock, p.tags,
			   p.discount_percentage, p.created_at,
			   s.name, s.slug, s.whatsapp_phone, s.location,
			   s.image_url AS store_image_url, s.mpesa_enabled, s.mpesa_status
		FROM products p
		LEFT JOIN stores s ON p.store_id = s.id
		WHERE p.id=$1`, productID)
	p, err := scanProduct(row, true)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch product"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"product": p})
}

// POST /products
func handleCreateProduct(c *gin.Context) {
	userID := c.GetString("user_id")

	// Verify user has a store
	var storeID string
	db.QueryRow("SELECT id FROM stores WHERE owner_id=$1", userID).Scan(&storeID)
	if storeID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "you must create a store first"})
		return
	}

	var req struct {
		Name               string   `json:"name" binding:"required"`
		Description        string   `json:"description"`
		Price              float64  `json:"price" binding:"required,min=0"`
		Category           string   `json:"category"`
		Quality            string   `json:"quality"`
		ImageURL           string   `json:"image_url"`
		ImageURLs          []string `json:"image_urls"`
		InStock            bool     `json:"in_stock"`
		Tags               []string `json:"tags"`
		DiscountPercentage float64  `json:"discount_percentage"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tagsLit := strArrLiteral(req.Tags)
	imageURLsLit := strArrLiteral(req.ImageURLs)

	var p Product
	var tags, imageURLs StrArr
	err := db.QueryRow(`
		INSERT INTO products (store_id, name, description, price, category, quality,
			image_url, image_urls, in_stock, tags, discount_percentage)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,$10::text[],$11)
		RETURNING id, store_id, name, description, price, category, quality,
			image_url, image_urls, in_stock, tags, discount_percentage, created_at`,
		storeID, req.Name, nullStr(req.Description), req.Price,
		nullStr(req.Category), nullStr(req.Quality), nullStr(req.ImageURL),
		imageURLsLit, req.InStock, tagsLit, req.DiscountPercentage,
	).Scan(
		&p.ID, &p.StoreID, &p.Name, &p.Description, &p.Price, &p.Category,
		&p.Quality, &p.ImageURL, &imageURLs, &p.InStock, &tags,
		&p.DiscountPercentage, &p.CreatedAt,
	)
	if err != nil {
		log.Printf("Create product error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create product"})
		return
	}
	p.Tags = tags
	p.ImageURLs = imageURLs
	c.JSON(http.StatusCreated, gin.H{"product": p})
}

// PUT /products/:id
func handleUpdateProduct(c *gin.Context) {
	userID := c.GetString("user_id")
	productID := c.Param("id")
	role := c.GetString("role")

	var storeOwnerID string
	db.QueryRow(`
		SELECT s.owner_id FROM products p
		JOIN stores s ON p.store_id = s.id
		WHERE p.id=$1`, productID).Scan(&storeOwnerID)
	if storeOwnerID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	if storeOwnerID != userID && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}

	var req struct {
		Name               string   `json:"name"`
		Description        string   `json:"description"`
		Price              *float64 `json:"price"`
		Category           string   `json:"category"`
		Quality            string   `json:"quality"`
		ImageURL           string   `json:"image_url"`
		ImageURLs          []string `json:"image_urls"`
		InStock            *bool    `json:"in_stock"`
		Tags               []string `json:"tags"`
		DiscountPercentage *float64 `json:"discount_percentage"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tagsLit := ""
	if req.Tags != nil {
		tagsLit = strArrLiteral(req.Tags)
	}
	imageURLsLit := ""
	if req.ImageURLs != nil {
		imageURLsLit = strArrLiteral(req.ImageURLs)
	}

	_, err := db.Exec(`
		UPDATE products SET
			name                = CASE WHEN $2='' THEN name ELSE $2 END,
			description         = CASE WHEN $3='' THEN description ELSE $3 END,
			price               = COALESCE($4, price),
			category            = CASE WHEN $5='' THEN category ELSE $5 END,
			quality             = CASE WHEN $6='' THEN quality ELSE $6 END,
			image_url           = CASE WHEN $7='' THEN image_url ELSE $7 END,
			image_urls          = CASE WHEN $8='' THEN image_urls ELSE $8::text[] END,
			in_stock            = COALESCE($9, in_stock),
			tags                = CASE WHEN $10='' THEN tags ELSE $10::text[] END,
			discount_percentage = COALESCE($11, discount_percentage),
			updated_at          = NOW()
		WHERE id=$1`,
		productID, req.Name, req.Description, req.Price, req.Category,
		req.Quality, req.ImageURL, imageURLsLit, req.InStock,
		tagsLit, req.DiscountPercentage,
	)
	if err != nil {
		log.Printf("Update product error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update product"})
		return
	}

	row := db.QueryRow(`
		SELECT p.id, p.store_id, p.name, p.description, p.price, p.category,
			   p.quality, p.image_url, p.image_urls, p.in_stock, p.tags,
			   p.discount_percentage, p.created_at, s.name, s.slug,
			   s.whatsapp_phone, s.location,
			   s.image_url AS store_image_url, s.mpesa_enabled, s.mpesa_status
		FROM products p LEFT JOIN stores s ON p.store_id = s.id
		WHERE p.id=$1`, productID)
	p, err := scanProduct(row, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch updated product"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"product": p})
}

// DELETE /products/:id
func handleDeleteProduct(c *gin.Context) {
	userID := c.GetString("user_id")
	productID := c.Param("id")
	role := c.GetString("role")

	var storeOwnerID string
	db.QueryRow(`
		SELECT s.owner_id FROM products p
		JOIN stores s ON p.store_id = s.id
		WHERE p.id=$1`, productID).Scan(&storeOwnerID)
	if storeOwnerID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	if storeOwnerID != userID && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}

	db.Exec("DELETE FROM products WHERE id=$1", productID)
	c.JSON(http.StatusOK, gin.H{"message": "product deleted"})
}

// GET /products/categories — list unique categories
func handleListCategories(c *gin.Context) {
	rows, err := db.Query(
		`SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch categories"})
		return
	}
	defer rows.Close()
	var cats []string
	for rows.Next() {
		var cat string
		rows.Scan(&cat)
		cats = append(cats, cat)
	}
	if cats == nil {
		cats = []string{}
	}
	c.JSON(http.StatusOK, gin.H{"categories": cats})
}

// POST /products/comparisons — add product to compare list
func handleAddComparison(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		ProductID string `json:"product_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := db.Exec(
		`INSERT INTO product_comparisons (user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
		userID, req.ProductID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add comparison"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "added to compare"})
}

// GET /products/comparisons
func handleGetComparisons(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, err := db.Query(`
		SELECT p.id, p.store_id, p.name, p.description, p.price, p.category,
			   p.quality, p.image_url, p.image_urls, p.in_stock, p.tags,
			   p.discount_percentage, p.created_at, s.name, s.slug,
			   s.whatsapp_phone, s.location,
			   s.image_url AS store_image_url, s.mpesa_enabled, s.mpesa_status
		FROM product_comparisons pc
		JOIN products p ON pc.product_id = p.id
		LEFT JOIN stores s ON p.store_id = s.id
		WHERE pc.user_id=$1
		ORDER BY pc.created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch comparisons"})
		return
	}
	defer rows.Close()
	var products []*Product
	for rows.Next() {
		p, err := scanProduct(rows, true)
		if err != nil {
			continue
		}
		products = append(products, p)
	}
	if products == nil {
		products = []*Product{}
	}
	c.JSON(http.StatusOK, gin.H{"products": products})
}

// DELETE /products/comparisons/:product_id
func handleRemoveComparison(c *gin.Context) {
	userID := c.GetString("user_id")
	productID := c.Param("product_id")
	db.Exec("DELETE FROM product_comparisons WHERE user_id=$1 AND product_id=$2", userID, productID)
	c.JSON(http.StatusOK, gin.H{"message": "removed from compare"})
}

// Image upload (multipart) — stores images to local disk or S3
// For now: accepts base64/URL in JSON body
func handleUploadProductImage(c *gin.Context) {
	_ = strconv.Itoa(0) // keep import
	c.JSON(http.StatusOK, gin.H{"message": "use image_url field directly with CDN URL"})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	initDB()

	r := gin.Default()
	r.Use(corsMiddleware())

	// Health check
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// Public routes
	r.GET("/products", handleListProducts)
	r.GET("/products/categories", handleListCategories)
	r.GET("/products/:id", handleGetProduct)

	// Authenticated routes
	auth := r.Group("/")
	auth.Use(authMiddleware())
	{
		auth.POST("/products", handleCreateProduct)
		auth.PUT("/products/:id", handleUpdateProduct)
		auth.DELETE("/products/:id", handleDeleteProduct)
		auth.POST("/products/comparisons", handleAddComparison)
		auth.GET("/products/comparisons", handleGetComparisons)
		auth.DELETE("/products/comparisons/:product_id", handleRemoveComparison)
	}

	port := getEnv("PORT", "8083")
	log.Printf("Product service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
