# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e6]:
        - link "Urban Stores Urban Stores" [ref=e7] [cursor=pointer]:
          - /url: /
          - img "Urban Stores" [ref=e8]
          - generic [ref=e9]: Urban Stores
        - generic [ref=e11]:
          - img [ref=e12]
          - textbox "Search products..." [ref=e15]
        - navigation [ref=e16]:
          - link "Marketplace" [ref=e17] [cursor=pointer]:
            - /url: /marketplace
          - link "Stores" [ref=e18] [cursor=pointer]:
            - /url: /stores
          - link "Categories" [ref=e19] [cursor=pointer]:
            - /url: /categories
          - link "Complaints" [ref=e20] [cursor=pointer]:
            - /url: /complaint
        - generic [ref=e22]:
          - button "Sign In" [ref=e23] [cursor=pointer]
          - button "Sign Up" [ref=e24] [cursor=pointer]
    - generic [ref=e25]:
      - heading "Please Login" [level=1] [ref=e26]
      - paragraph [ref=e27]: You need to login to view your cart
      - link "Login" [ref=e28] [cursor=pointer]:
        - /url: /auth
        - button "Login" [ref=e29]
```