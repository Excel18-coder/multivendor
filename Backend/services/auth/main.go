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
	"golang.org/x/crypto/bcrypt"
)

// ─── Models ─────────────────────────────────────────────────────────────────

type Profile struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	FullName  *string `json:"full_name"`
	Role      string  `json:"role"`
	UserType  string  `json:"user_type"`
	CreatedAt string  `json:"created_at"`
}

type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// ─── DB ─────────────────────────────────────────────────────────────────────

var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		host := getEnv("DB_HOST", "localhost")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "postgres")
		pass := getEnv("DB_PASSWORD", "postgres")
		name := getEnv("DB_NAME", "multivendor")
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			host, port, user, pass, name)
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
	db.SetMaxIdleConns(5)
	log.Println("Auth service: DB connected")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

func jwtSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		s = "multivendor-super-secret-jwt-key-change-in-prod"
	}
	return []byte(s)
}

func generateToken(userID, email, userType, role string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Email:    email,
		UserType: userType,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   userID,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
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
		c.Set("email", claims.Email)
		c.Set("user_type", claims.UserType)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// POST /auth/register
func handleRegister(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		FullName string `json:"full_name"`
		UserType string `json:"user_type"` // buyer | seller
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.UserType == "" {
		req.UserType = "buyer"
	}
	if req.UserType != "buyer" && req.UserType != "seller" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_type must be 'buyer' or 'seller'"})
		return
	}

	// Check if email exists
	var exists bool
	_ = db.QueryRow("SELECT EXISTS(SELECT 1 FROM profiles WHERE email=$1)", req.Email).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	var profile Profile
	err = db.QueryRow(
		`INSERT INTO profiles (email, password, full_name, user_type, role)
		 VALUES ($1, $2, $3, $4, 'user')
		 RETURNING id, email, full_name, role, user_type, created_at`,
		req.Email, string(hash), nullStr(req.FullName), req.UserType,
	).Scan(&profile.ID, &profile.Email, &profile.FullName, &profile.Role, &profile.UserType, &profile.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create account"})
		return
	}

	token, err := generateToken(profile.ID, profile.Email, profile.UserType, profile.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  profile,
	})
}

// POST /auth/login
func handleLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var profile Profile
	var hashedPwd string
	err := db.QueryRow(
		`SELECT id, email, full_name, role, user_type, password, created_at
		 FROM profiles WHERE email=$1`, req.Email,
	).Scan(&profile.ID, &profile.Email, &profile.FullName, &profile.Role,
		&profile.UserType, &hashedPwd, &profile.CreatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	token, err := generateToken(profile.ID, profile.Email, profile.UserType, profile.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  profile,
	})
}

// GET /auth/me
func handleMe(c *gin.Context) {
	userID := c.GetString("user_id")
	var profile Profile
	err := db.QueryRow(
		`SELECT id, email, full_name, role, user_type, created_at
		 FROM profiles WHERE id=$1`, userID,
	).Scan(&profile.ID, &profile.Email, &profile.FullName, &profile.Role,
		&profile.UserType, &profile.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": profile})
}

// PUT /auth/profile
func handleUpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		FullName string `json:"full_name"`
		UserType string `json:"user_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.UserType != "" && req.UserType != "buyer" && req.UserType != "seller" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_type must be 'buyer' or 'seller'"})
		return
	}

	var profile Profile
	err := db.QueryRow(
		`UPDATE profiles SET
			full_name = COALESCE(NULLIF($2,''), full_name),
			user_type = COALESCE(NULLIF($3,''), user_type),
			updated_at = NOW()
		 WHERE id=$1
		 RETURNING id, email, full_name, role, user_type, created_at`,
		userID, req.FullName, req.UserType,
	).Scan(&profile.ID, &profile.Email, &profile.FullName, &profile.Role,
		&profile.UserType, &profile.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": profile})
}

// PUT /auth/change-password
func handleChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var hashedPwd string
	if err := db.QueryRow("SELECT password FROM profiles WHERE id=$1", userID).Scan(&hashedPwd); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	_, err := db.Exec("UPDATE profiles SET password=$1, updated_at=NOW() WHERE id=$2", string(hash), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to change password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "password changed successfully"})
}

// DELETE /auth/account
func handleDeleteAccount(c *gin.Context) {
	userID := c.GetString("user_id")
	_, err := db.Exec("DELETE FROM profiles WHERE id=$1", userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete account"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "account deleted successfully"})
}

// POST /auth/validate (internal use by gateway)
func handleValidate(c *gin.Context) {
	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	claims, err := validateToken(req.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"valid": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"valid":     true,
		"user_id":   claims.UserID,
		"email":     claims.Email,
		"user_type": claims.UserType,
		"role":      claims.Role,
	})
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
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	r.POST("/auth/register", handleRegister)
	r.POST("/auth/login", handleLogin)
	r.POST("/auth/validate", handleValidate)

	protected := r.Group("/auth")
	protected.Use(authMiddleware())
	{
		protected.GET("/me", handleMe)
		protected.PUT("/profile", handleUpdateProfile)
		protected.PUT("/change-password", handleChangePassword)
		protected.DELETE("/account", handleDeleteAccount)
	}

	port := getEnv("PORT", "8081")
	log.Printf("Auth service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
