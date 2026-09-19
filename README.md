# REST vs GraphQL: Demo + วิธีทดสอบ

โปรเจกต์ตัวอย่างที่รันได้จริง มีทั้ง REST API (Express) และ GraphQL API (Apollo Server) ใช้ข้อมูลชุดเดียวกัน พร้อมชุดทดสอบอัตโนมัติ

## โครงสร้างไฟล์

```
api-demo/
├── data.js                 # ข้อมูลจำลอง (in-memory) สร้างใหม่ได้ทุกครั้ง
├── rest/server.js          # REST API  -> http://localhost:3000
├── graphql/server.js       # GraphQL API -> http://localhost:4000
├── tests/rest.test.js      # เทสต์ REST (Jest + Supertest)
├── tests/graphql.test.js   # เทสต์ GraphQL (Jest + Apollo executeOperation + HTTP จริง)
└── package.json
```

## ติดตั้งและรัน

ต้องมี Node.js 18 ขึ้นไป

```bash
npm install
npm run start:rest       # เปิด REST ที่ http://localhost:3000
npm run start:graphql    # เปิด GraphQL ที่ http://localhost:4000  (เปิดคนละ terminal)
```

---

## ส่วนที่ 1: ทดสอบด้วยมือ (Manual Testing)

เหมาะสำหรับสาธิตตอนพรีเซนต์ ให้เปิดเซิร์ฟเวอร์ก่อน

### REST: ทดสอบด้วย curl

```bash
# อ่าน user (สังเกตว่าได้ email กับ age มาด้วย = over-fetching)
curl localhost:3000/users/1

# ต้องยิงอีกครั้งเพื่อเอา posts (= under-fetching)
curl localhost:3000/users/1/posts

# user ที่ไม่มีอยู่ -> 404
curl -i localhost:3000/users/999

# สร้าง user -> 201
curl -i -X POST localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Somsri","email":"somsri@example.com"}'

# ส่งข้อมูลไม่ครบ -> 400
curl -i -X POST localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"No Email"}'

# แก้ไข / ลบ
curl -X PUT localhost:3000/users/1 -H "Content-Type: application/json" -d '{"name":"New Name"}'
curl -i -X DELETE localhost:3000/users/2        # -> 204
```

> **Windows (PowerShell):** ใช้ `curl.exe` แทน `curl` และใส่ JSON ในเครื่องหมาย `'...'` ให้ escape เครื่องหมาย `"` เป็น `\"` หรือใช้ Postman แทนก็ได้

### GraphQL: ทดสอบด้วย Apollo Sandbox (แนะนำสำหรับพรีเซนต์)

เปิดเบราว์เซอร์ไปที่ **http://localhost:4000** จะเจอหน้า Apollo Sandbox ที่มีช่องพิมพ์ query และดู Schema ได้ทันที

ลองพิมพ์:

```graphql
query {
  user(id: "1") {
    name
    posts {
      title
    }
  }
}
```

ลองเปลี่ยน field ที่ขอ (เช่นเพิ่ม `email`, ลบ `posts`) แล้วดู response ว่าเปลี่ยนตามทันที นี่คือจุดเด่นที่ควรโชว์

ตัวอย่าง Mutation:

```graphql
mutation {
  createUser(name: "Somsri", email: "somsri@example.com") {
    id
    name
  }
}
```

### GraphQL: ทดสอบด้วย curl

```bash
curl localhost:4000/ -H "Content-Type: application/json" \
  -d '{"query":"{ user(id: \"1\") { name posts { title } } }"}'
```

### ทดสอบด้วย Postman

- **REST:** สร้าง request ตาม method และ URL ด้านบน (body เลือก raw > JSON)
- **GraphQL:** New > GraphQL, ใส่ URL `http://localhost:4000` แล้วพิมพ์ query ได้เลย

---

## ส่วนที่ 2: ทดสอบอัตโนมัติ (Automated Testing)

```bash
npm test                # รันทั้งหมด
npm run test:rest       # เฉพาะ REST
npm run test:graphql    # เฉพาะ GraphQL
```

ไม่ต้องเปิดเซิร์ฟเวอร์ก่อน เพราะเทสต์สร้างเซิร์ฟเวอร์ของตัวเองขึ้นมา

### หลักการที่ใช้ในเทสต์

1. **Arrange / Act / Assert**: เตรียมข้อมูล, ยิง request, ตรวจผลลัพธ์
2. **Test isolation**: ทุกเทสต์เริ่มด้วยฐานข้อมูลใหม่ (`beforeEach` เรียก `createApp()` / `createServer()`) เทสต์ที่สร้างหรือลบข้อมูลจึงไม่กระทบเทสต์อื่น
3. **ทดสอบทั้ง happy path และ error path**: เช่น 404, 400 ใน REST และ validation error ใน GraphQL
4. **ตรวจ side effect**: หลัง POST หรือ DELETE ให้ GET กลับมาเช็กว่าข้อมูลเปลี่ยนจริง

### REST: ใช้ Jest + Supertest

Supertest เรียก Express app ได้โดยตรง ไม่ต้องเปิด port

```js
const res = await request(app).get('/users/999');
expect(res.status).toBe(404);
expect(res.body).toEqual({ error: 'User not found' });
```

สิ่งที่ตรวจ: status code (200, 201, 204, 400, 404), รูปร่างของ response body, และการเปลี่ยนแปลงของข้อมูลหลัง POST/PUT/DELETE

### GraphQL: ใช้ Jest + `executeOperation`

Apollo Server มี `executeOperation` ให้รัน query ตรงๆ โดยไม่ผ่าน HTTP จึงเร็วมาก

```js
const res = await server.executeOperation({ query: `{ user(id: "1") { name } }` });
expect(res.body.singleResult.data).toEqual({ user: { name: 'Somchai' } });
```

สิ่งที่ตรวจ: ข้อมูลต้องตรงกับ field ที่ขอเท่านั้น, nested query ได้ครบในครั้งเดียว, variables, mutation, และ error

ส่วนท้ายของไฟล์ยังมีเทสต์ **HTTP จริง** (เปิดเซิร์ฟเวอร์บน port สุ่ม แล้วใช้ `fetch`) เพื่อดู status code ที่ client ได้รับจริง

### ข้อแตกต่างในการทดสอบ REST vs GraphQL

| หัวข้อ | REST | GraphQL |
|---|---|---|
| ตรวจ error | ดู HTTP status code (404, 400) | ดู `errors` ใน body และ `extensions.code` |
| ไม่พบข้อมูล | 404 | ได้ `null` ใน `data` (ไม่มี error) |
| Resolver error | 4xx / 5xx | HTTP **200** พร้อม `errors` array |
| Validation error (query ผิด schema) | 400 (ถ้าเขียนเอง) | HTTP **400** ใน Apollo Server พร้อม `GRAPHQL_VALIDATION_FAILED` |
| ตรวจรูปร่างข้อมูล | ตรวจ body ทั้งก้อน (มี field เกินได้) | `toEqual` ต้องตรงกับ field ที่ขอเป๊ะ |
| จำนวน request ที่ต้องยิง | หลายครั้งถ้าข้อมูลสัมพันธ์กัน | ครั้งเดียว |

## ต่อยอดได้

- เพิ่ม **DataLoader** แล้วเขียนเทสต์นับจำนวนครั้งที่ query database (แก้ N+1)
- เพิ่ม **query depth limit** แล้วเทสต์ว่า query ลึกเกินถูกปฏิเสธ
- ใช้ `--coverage` ดูว่าเทสต์ครอบคลุมโค้ดแค่ไหน: `npx jest --coverage`
- ต่อเข้า CI (เช่น GitHub Actions) ให้รัน `npm test` ทุกครั้งที่ push
