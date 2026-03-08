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
      - generic [ref=e11]:
        - generic [ref=e12]:
          - heading "Marketplace" [level=1] [ref=e13]
          - generic [ref=e14]:
            - generic [ref=e15]:
              - img [ref=e16]
              - textbox "Search products..." [ref=e19]
            - button [ref=e20] [cursor=pointer]:
              - img
        - generic [ref=e21]: 0 products found
      - generic [ref=e23]:
        - generic [ref=e24]:
          - img [ref=e25]
          - heading "No products found" [level=3] [ref=e28]
          - paragraph [ref=e29]: Try adjusting your search terms or filters
        - button "Clear Filters" [ref=e30] [cursor=pointer]
```