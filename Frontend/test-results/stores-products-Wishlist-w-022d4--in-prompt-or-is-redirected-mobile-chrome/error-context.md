# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e6]:
        - link "Urban Stores" [ref=e7] [cursor=pointer]:
          - /url: /
          - img "Urban Stores" [ref=e8]
        - button [ref=e9] [cursor=pointer]:
          - img
    - generic [ref=e10]:
      - heading "Please Login" [level=1] [ref=e11]
      - paragraph [ref=e12]: You need to login to view your wishlist
      - link "Login" [ref=e13] [cursor=pointer]:
        - /url: /auth
        - button "Login" [ref=e14]
```