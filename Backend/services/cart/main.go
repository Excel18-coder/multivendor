package main

import (
	"database/sql"
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

type CartItem struct {
	ID           string   `json:"id"`
	UserID       string   `json:"user_id"`
	ProductID    string   `json:"product_id"`
	Quantity     int      `json:"quantity"`
	CreatedAt    string   `json:"created_at"`
	ProductName  *string  `json:"product_name,omitempty"`
	Price        *float64 `json:"price,omitempty"`
	ImageURL     *string  `json:"image_url,omitempty"`
	StoreID      *string  `json:"store_id,omitempty"`
	StoreName    *string  `json:"store_name,omitempty"`
	StoreSlug    *string  `json:"store_slug,omitempty"`
	WaPhone      *string  `json:"whatsapp_phone,omitempty"`
	MpesaEnabled *bool    `json:"mpesa_enabled,omitempty"`
	MpesaStatus  *string  `json:"mpesa_status,omitempty"`
}

type WishlistItem struct {
	ID          string   `json:"id"`
	UserID      string   `json:"user_id"`
	ProductID   string   `json:"product_id"`
	CreatedAt   string   `json:"created_at"`
	ProductName *string  `json:"product_name,omitempty"`
	Price       *float64 `json:"price,omitempty"`
	ImageURL    *string  `json:"image_url,omitempty"`
	StoreName   *string  `json:"store_name,omitempty"`
}

type Order struct {
	ID              string      `json:"id"`
	UserID          string      `json:"user_id"`
	Status          string      `json:"status"`
	TotalAmount     float64     `json:"total_amount"`
	ShippingAddress *string     `json:"shipping_address"`
	CreatedAt       string      `json:"created_at"`
	Items           []OrderItem `json:"items,omitempty"`
}

type OrderItem struct {
	ID          string  `json:"id"`
	OrderID     string  `json:"order_id"`
	ProductID   string  `json:"product_id"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
	ProductName *string `json:"product_name,omitempty"`
	ImageURL    *string `json:"image_url,omitempty"`
	CreatedAt   string  `json:"created_at"`
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
	log.Println("Cart service: DB connected")
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

// ─── Cart Handlers ────────────────────────────────────────────────────────────

// GET /cart
func handleGetCart(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, err := db.Query(`
		SELECT c.id, c.user_id, c.product_id, c.quantity, c.created_at,
			   p.name, p.price, p.image_url,
			   p.store_id, s.name, s.slug, s.whatsapp_phone, s.mpesa_enabled, s.mpesa_status
		FROM cart c
		JOIN products p ON c.product_id = p.id
		LEFT JOIN stores s ON p.store_id = s.id
		WHERE c.user_id=$1
		ORDER BY c.created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch cart"})
		return
	}
	defer rows.Close()

	var items []CartItem
	for rows.Next() {
		var item CartItem
		err := rows.Scan(
			&item.ID, &item.UserID, &item.ProductID, &item.Quantity, &item.CreatedAt,
			&item.ProductName, &item.Price, &item.ImageURL,
			&item.StoreID, &item.StoreName, &item.StoreSlug, &item.WaPhone,
			&item.MpesaEnabled, &item.MpesaStatus,
		)
		if err != nil {
			log.Printf("Scan cart item error: %v", err)
			continue
		}
		items = append(items, item)
	}
	if items == nil {
		items = []CartItem{}
	}

	// Total count
	total := 0
	for _, item := range items {
		total += item.Quantity
	}

	c.JSON(http.StatusOK, gin.H{"items": items, "total_quantity": total})
}

// POST /cart
func handleAddToCart(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		ProductID string `json:"product_id" binding:"required"`
		Quantity  int    `json:"quantity"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	// Check existing
	var existingID string
	var existingQty int
	db.QueryRow("SELECT id, quantity FROM cart WHERE user_id=$1 AND product_id=$2", userID, req.ProductID).
		Scan(&existingID, &existingQty)

	if existingID != "" {
		newQty := existingQty + req.Quantity
		_, err := db.Exec("UPDATE cart SET quantity=$1 WHERE id=$2", newQty, existingID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update cart"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "cart updated", "id": existingID, "quantity": newQty})
		return
	}

	var id, createdAt string
	err := db.QueryRow(
		`INSERT INTO cart (user_id, product_id, quantity) VALUES ($1,$2,$3) RETURNING id, created_at`,
		userID, req.ProductID, req.Quantity,
	).Scan(&id, &createdAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add to cart"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "created_at": createdAt, "quantity": req.Quantity})
}

// PUT /cart/:id
func handleUpdateCartItem(c *gin.Context) {
	userID := c.GetString("user_id")
	itemID := c.Param("id")
	var req struct {
		Quantity int `json:"quantity" binding:"required,min=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Quantity == 0 {
		db.Exec("DELETE FROM cart WHERE id=$1 AND user_id=$2", itemID, userID)
		c.JSON(http.StatusOK, gin.H{"message": "item removed"})
		return
	}
	db.Exec("UPDATE cart SET quantity=$1 WHERE id=$2 AND user_id=$3", req.Quantity, itemID, userID)
	c.JSON(http.StatusOK, gin.H{"message": "cart updated", "quantity": req.Quantity})
}

// DELETE /cart/:id
func handleRemoveCartItem(c *gin.Context) {
	userID := c.GetString("user_id")
	itemID := c.Param("id")
	db.Exec("DELETE FROM cart WHERE id=$1 AND user_id=$2", itemID, userID)
	c.JSON(http.StatusOK, gin.H{"message": "item removed"})
}

// DELETE /cart
func handleClearCart(c *gin.Context) {
	userID := c.GetString("user_id")
	db.Exec("DELETE FROM cart WHERE user_id=$1", userID)
	c.JSON(http.StatusOK, gin.H{"message": "cart cleared"})
}

// ─── Wishlist Handlers ────────────────────────────────────────────────────────

// GET /wishlist
func handleGetWishlist(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, err := db.Query(`
		SELECT w.id, w.user_id, w.product_id, w.created_at,
			   p.name, p.price, p.image_url, s.name
		FROM wishlist w
		JOIN products p ON w.product_id = p.id
		LEFT JOIN stores s ON p.store_id = s.id
		WHERE w.user_id=$1
		ORDER BY w.created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch wishlist"})
		return
	}
	defer rows.Close()

	var items []WishlistItem
	for rows.Next() {
		var item WishlistItem
		rows.Scan(
			&item.ID, &item.UserID, &item.ProductID, &item.CreatedAt,
			&item.ProductName, &item.Price, &item.ImageURL, &item.StoreName,
		)
		items = append(items, item)
	}
	if items == nil {
		items = []WishlistItem{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// POST /wishlist
func handleAddToWishlist(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		ProductID string `json:"product_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id, createdAt string
	err := db.QueryRow(
		`INSERT INTO wishlist (user_id, product_id) VALUES ($1,$2)
		 ON CONFLICT (user_id, product_id) DO NOTHING
		 RETURNING id, created_at`,
		userID, req.ProductID,
	).Scan(&id, &createdAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusConflict, gin.H{"error": "product already in wishlist"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add to wishlist"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "created_at": createdAt})
}

// DELETE /wishlist/:id
func handleRemoveFromWishlist(c *gin.Context) {
	userID := c.GetString("user_id")
	itemID := c.Param("id")
	db.Exec("DELETE FROM wishlist WHERE id=$1 AND user_id=$2", itemID, userID)
	c.JSON(http.StatusOK, gin.H{"message": "removed from wishlist"})
}

// ─── Order Handlers ───────────────────────────────────────────────────────────

// GET /orders
func handleGetOrders(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, err := db.Query(`
		SELECT id, user_id, status, total_amount, shipping_address, created_at
		FROM orders WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch orders"})
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var o Order
		rows.Scan(&o.ID, &o.UserID, &o.Status, &o.TotalAmount, &o.ShippingAddress, &o.CreatedAt)
		orders = append(orders, o)
	}
	if orders == nil {
		orders = []Order{}
	}
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

// GET /orders/:id
func handleGetOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	orderID := c.Param("id")

	var o Order
	err := db.QueryRow(
		`SELECT id, user_id, status, total_amount, shipping_address, created_at
		 FROM orders WHERE id=$1 AND user_id=$2`, orderID, userID,
	).Scan(&o.ID, &o.UserID, &o.Status, &o.TotalAmount, &o.ShippingAddress, &o.CreatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch order"})
		return
	}

	// Get order items
	itemRows, _ := db.Query(`
		SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price, oi.created_at,
			   p.name, p.image_url
		FROM order_items oi
		LEFT JOIN products p ON oi.product_id = p.id
		WHERE oi.order_id=$1`, orderID)
	defer itemRows.Close()
	for itemRows.Next() {
		var item OrderItem
		itemRows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.Quantity, &item.Price,
			&item.CreatedAt, &item.ProductName, &item.ImageURL)
		o.Items = append(o.Items, item)
	}
	if o.Items == nil {
		o.Items = []OrderItem{}
	}

	c.JSON(http.StatusOK, gin.H{"order": o})
}

// POST /orders
func handleCreateOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		ShippingAddress string `json:"shipping_address" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get cart items
	rows, err := db.Query(`
		SELECT c.product_id, c.quantity, p.price
		FROM cart c
		JOIN products p ON c.product_id = p.id
		WHERE c.user_id=$1`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch cart"})
		return
	}
	defer rows.Close()

	type cartEntry struct {
		ProductID string
		Quantity  int
		Price     float64
	}
	var entries []cartEntry
	var total float64
	for rows.Next() {
		var e cartEntry
		rows.Scan(&e.ProductID, &e.Quantity, &e.Price)
		entries = append(entries, e)
		total += e.Price * float64(e.Quantity)
	}
	if len(entries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cart is empty"})
		return
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback()

	var orderID, createdAt string
	err = tx.QueryRow(
		`INSERT INTO orders (user_id, total_amount, shipping_address, status)
		 VALUES ($1,$2,$3,'pending') RETURNING id, created_at`,
		userID, total, req.ShippingAddress,
	).Scan(&orderID, &createdAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create order"})
		return
	}

	for _, e := range entries {
		_, err = tx.Exec(
			`INSERT INTO order_items (order_id, product_id, quantity, price)
			 VALUES ($1,$2,$3,$4)`,
			orderID, e.ProductID, e.Quantity, e.Price,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create order items"})
			return
		}
	}

	// Clear cart
	tx.Exec("DELETE FROM cart WHERE user_id=$1", userID)

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit order"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":           orderID,
		"total_amount": total,
		"status":       "pending",
		"created_at":   createdAt,
	})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	initDB()

	r := gin.Default()
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	auth := r.Group("/")
	auth.Use(authMiddleware())
	{
		// Cart
		auth.GET("/cart", handleGetCart)
		auth.POST("/cart", handleAddToCart)
		auth.PUT("/cart/:id", handleUpdateCartItem)
		auth.DELETE("/cart/:id", handleRemoveCartItem)
		auth.DELETE("/cart", handleClearCart)

		// Wishlist
		auth.GET("/wishlist", handleGetWishlist)
		auth.POST("/wishlist", handleAddToWishlist)
		auth.DELETE("/wishlist/:id", handleRemoveFromWishlist)

		// Orders
		auth.GET("/orders", handleGetOrders)
		auth.GET("/orders/:id", handleGetOrder)
		auth.POST("/orders", handleCreateOrder)
	}

	port := getEnv("PORT", "8084")
	log.Printf("Cart service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
