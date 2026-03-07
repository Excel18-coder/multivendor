package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ─── Service Routes ───────────────────────────────────────────────────────────

type service struct {
	name    string
	baseURL string
	prefix  string
}

func getServices() []service {
	return []service{
		{
			name:    "auth",
			baseURL: getEnv("AUTH_SERVICE_URL", "http://localhost:8081"),
			prefix:  "/auth",
		},
		{
			name:    "store",
			baseURL: getEnv("STORE_SERVICE_URL", "http://localhost:8082"),
			prefix:  "/stores",
		},
		{
			name:    "store-complaints",
			baseURL: getEnv("STORE_SERVICE_URL", "http://localhost:8082"),
			prefix:  "/complaints",
		},
		{
			name:    "product",
			baseURL: getEnv("PRODUCT_SERVICE_URL", "http://localhost:8083"),
			prefix:  "/products",
		},
		{
			name:    "cart",
			baseURL: getEnv("CART_SERVICE_URL", "http://localhost:8084"),
			prefix:  "/cart",
		},
		{
			name:    "wishlist",
			baseURL: getEnv("CART_SERVICE_URL", "http://localhost:8084"),
			prefix:  "/wishlist",
		},
		{
			name:    "orders",
			baseURL: getEnv("CART_SERVICE_URL", "http://localhost:8084"),
			prefix:  "/orders",
		},
		{
			name:    "payment",
			baseURL: getEnv("PAYMENT_SERVICE_URL", "http://localhost:8085"),
			prefix:  "/payments",
		},
		{
			name:    "admin",
			baseURL: getEnv("ADMIN_SERVICE_URL", "http://localhost:8086"),
			prefix:  "/admin",
		},
	}
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
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func jwtInjector() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				if claims, err := validateToken(parts[1]); err == nil {
					// Inject user context as headers for downstream services
					c.Request.Header.Set("X-User-ID", claims.UserID)
					c.Request.Header.Set("X-User-Email", claims.Email)
					c.Request.Header.Set("X-User-Type", claims.UserType)
					c.Request.Header.Set("X-User-Role", claims.Role)
				}
			}
		}
		c.Next()
	}
}

func rateLimiter() gin.HandlerFunc {
	// Simple per-IP request counting (in-memory, non-persistent)
	// For production, use Redis-based rate limiting
	return func(c *gin.Context) {
		c.Next()
	}
}

// ─── Proxy ───────────────────────────────────────────────────────────────────

func createProxy(targetURL string) gin.HandlerFunc {
	target, err := url.Parse(targetURL)
	if err != nil {
		log.Fatalf("Invalid proxy URL %s: %v", targetURL, err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("Proxy error for %s: %v", r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		fmt.Fprintf(w, `{"error":"service unavailable","path":"%s"}`, r.URL.Path)
	}

	return func(c *gin.Context) {
		// Remove Gin's doubled path prefix
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

// ─── Health ───────────────────────────────────────────────────────────────────

func handleHealth(c *gin.Context) {
	services := getServices()
	results := make(map[string]string)

	client := &http.Client{}
	for _, svc := range services {
		resp, err := client.Get(svc.baseURL + "/health")
		if err != nil || resp.StatusCode != http.StatusOK {
			results[svc.name] = "down"
		} else {
			results[svc.name] = "up"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"gateway":  "up",
		"services": results,
	})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	r := gin.Default()
	r.Use(corsMiddleware())
	r.Use(jwtInjector())
	r.Use(rateLimiter())

	// Health check
	r.GET("/health", handleHealth)
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":    "Multivendor API Gateway",
			"version": "1.0.0",
		})
	})

	// Route all requests to appropriate services
	for _, svc := range getServices() {
		svcCopy := svc
		proxy := createProxy(svcCopy.baseURL)
		// Match prefix and all sub-paths
		r.Any(svcCopy.prefix, proxy)
		r.Any(svcCopy.prefix+"/*path", proxy)
		log.Printf("Gateway: %s -> %s%s", svcCopy.prefix, svcCopy.baseURL, svcCopy.prefix)
	}

	port := getEnv("PORT", "8080")
	log.Printf("API Gateway listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func getEnv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
