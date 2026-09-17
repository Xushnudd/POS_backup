#!/bin/bash

# ==========================================
# POS API Test Automation Script
# ==========================================

BASE_URL="http://localhost:3000/api"

# Natija fayllarini tozalash / boshlash
SUCCESS_FILE="success.md"
ERROR_FILE="error.md"

cat <<EOF > "$SUCCESS_FILE"
# API Muvaffaqiyatli So'rovlar Jurnali (Success Log)
Yuborilgan sana: $(date)
Base URL: $BASE_URL

EOF

cat <<EOF > "$ERROR_FILE"
# API Xatoliklar Jurnali (Error Log)
Yuborilgan sana: $(date)
Base URL: $BASE_URL

EOF

echo "API test jarayoni boshlandi..."
echo "Base URL: $BASE_URL"

TOKEN=""
ORG_ID=""
STORE_ID=""
REGISTER_ID=""
CATEGORY_ID=""
PRODUCT_ID=""
CUSTOMER_ID=""
SUPPLIER_ID=""
SHIFT_ID=""
SALE_ID=""
TRANSFER_ID=""
STOCK_DOC_ID=""
USER_ID=""

# Helper funksiya: curl orqali so'rov yuborish
send_request() {
  local method="$1"
  local endpoint="$2"
  local payload="$3"
  local desc="$4"

  local url="${BASE_URL}${endpoint}"
  local response_file=$(mktemp)
  local http_code

  if [ -n "$payload" ]; then
    if [ -n "$TOKEN" ]; then
      http_code=$(curl -s -w "%{http_code}" -o "$response_file" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$payload")
    else
      http_code=$(curl -s -w "%{http_code}" -o "$response_file" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -d "$payload")
    fi
  else
    if [ -n "$TOKEN" ]; then
      http_code=$(curl -s -w "%{http_code}" -o "$response_file" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN")
    else
      http_code=$(curl -s -w "%{http_code}" -o "$response_file" -X "$method" "$url" \
        -H "Content-Type: application/json")
    fi
  fi

  local response_body=$(cat "$response_file")
  rm -f "$response_file"

  # JSON ichidagi 'success' maydonini tekshirish
  local is_success=$(echo "$response_body" | grep -o '"success":true' || true)

  if [[ "$http_code" =~ ^20[0-9]$ ]] && [ -n "$is_success" ]; then
    echo " [OK $http_code] $desc"
    cat <<EOF >> "$SUCCESS_FILE"
## [SUCCESS] $method $endpoint
- **Tavsif:** $desc
- **HTTP Status:** $http_code
- **Yuborilgan Payload:**
\`\`\`json
${payload:-"{}"}
\`\`\`
- **Qaytgan Javob:**
\`\`\`json
$response_body
\`\`\`

---
EOF
  else
    echo " [ERR $http_code] $desc"
    cat <<EOF >> "$ERROR_FILE"
## [ERROR] $method $endpoint
- **Tavsif:** $desc
- **HTTP Status:** $http_code
- **Yuborilgan Payload:**
\`\`\`json
${payload:-"{}"}
\`\`\`
- **Qaytgan Xato Javobi:**
\`\`\`json
$response_body
\`\`\`

---
EOF
  fi

  LAST_RESPONSE="$response_body"
}

# ----------------------------------------------------
# 1. Autentifikatsiya
# ----------------------------------------------------
RAND_SUFFIX=$((RANDOM % 899999 + 100000))
PHONE="+99890${RAND_SUFFIX}"

REGISTER_PAYLOAD=$(cat <<EOF
{
  "fullName": "Test Admin",
  "phone": "$PHONE",
  "email": "admin_${RAND_SUFFIX}@example.com",
  "password": "password123",
  "organizationName": "Test Org $RAND_SUFFIX",
  "tin": "123456789"
}
EOF
)

send_request "POST" "/auth/register" "$REGISTER_PAYLOAD" "Yangi foydalanuvchi va tashkilot ro'yxatdan o'tkazish"

# Token, Org, Store va Register ID larni ajratib olish
TOKEN=$(echo "$LAST_RESPONSE" | grep -o '"token":"[^"]*' | grep -o '[^"]*$' || true)
ORG_ID=$(echo "$LAST_RESPONSE" | grep -o '"organization":{[^}]*' | grep -o '"id":"[^"]*' | grep -o '[^"]*$' || true)

LOGIN_PAYLOAD=$(cat <<EOF
{
  "phone": "$PHONE",
  "password": "password123"
}
EOF
)
send_request "POST" "/auth/login" "$LOGIN_PAYLOAD" "Tizimga kirish (Login)"

send_request "GET" "/auth/me" "" "Joriy foydalanuvchi ma'lumotlarini olish (/auth/me)"

# ----------------------------------------------------
# 2. Tashkilotlar va foydalanuvchilar
# ----------------------------------------------------
send_request "GET" "/organizations" "" "Tashkilotlar ro'yxatini olish"

NEW_ORG_PAYLOAD=$(cat <<EOF
{
  "name": "Ikkinchi Tashkilot $RAND_SUFFIX",
  "tin": "987654321",
  "phone": "+998911234567",
  "currencyCode": "UZS",
  "timezone": "Asia/Tashkent",
  "allowNegativeStock": false,
  "receiptFooter": "Rahmat"
}
EOF
)
send_request "POST" "/organizations" "$NEW_ORG_PAYLOAD" "Yangi tashkilot yaratish"

if [ -n "$ORG_ID" ]; then
  send_request "GET" "/organizations/$ORG_ID" "" "Tashkilot tafsilotlarini olish"

  UPDATE_ORG_PAYLOAD='{"receiptFooter": "Xaridingiz uchun rahmat!"}'
  send_request "PUT" "/organizations/$ORG_ID" "$UPDATE_ORG_PAYLOAD" "Tashkilot sozlamalarini yangilash"

  send_request "GET" "/organizations/$ORG_ID/users" "" "Tashkilot foydalanuvchilarini olish"

  CREATE_USER_PAYLOAD=$(cat <<EOF
{
  "fullName": "Test Kassir",
  "phone": "+99893${RAND_SUFFIX}",
  "email": "cashier_${RAND_SUFFIX}@example.com",
  "password": "password123",
  "role": "cashier"
}
EOF
)
  send_request "POST" "/organizations/$ORG_ID/users" "$CREATE_USER_PAYLOAD" "Tashkilotga foydalanuvchi qo'shish"
fi

# ----------------------------------------------------
# 3. Do'konlar va kassalar
# ----------------------------------------------------
if [ -n "$ORG_ID" ]; then
  send_request "GET" "/stores?organizationId=$ORG_ID" "" "Do'konlar ro'yxatini olish"

  CREATE_STORE_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "name": "Chilonzor Filiali",
  "address": "Toshkent",
  "phone": "+998901234567"
}
EOF
)
  send_request "POST" "/stores" "$CREATE_STORE_PAYLOAD" "Yangi do'kon yaratish"
  STORE_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

  if [ -n "$STORE_ID" ]; then
    send_request "GET" "/stores/$STORE_ID" "" "Do'kon tafsilotini olish"
    send_request "PUT" "/stores/$STORE_ID" '{"address": "Toshkent, Chilonzor 19"}' "Do'konni yangilash"

    CREATE_REG_PAYLOAD='{"name": "Kassa 2", "code": "REG002"}'
    send_request "POST" "/stores/$STORE_ID/registers" "$CREATE_REG_PAYLOAD" "Do'konga kassa qo'shish"
    REGISTER_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

    send_request "GET" "/stores/$STORE_ID/registers" "" "Do'konga tegishli kassalarni olish"
  fi

  if [ -n "$REGISTER_ID" ]; then
    send_request "PUT" "/registers/$REGISTER_ID" '{"name": "Kassa 2 (Asosiy)"}' "Kassa nomini yangilash"
  fi
fi

# ----------------------------------------------------
# 4. Katalog (Kategoriyalar va Mahsulotlar)
# ----------------------------------------------------
if [ -n "$ORG_ID" ]; then
  send_request "GET" "/categories?organizationId=$ORG_ID" "" "Kategoriyalar ro'yxatini olish"

  CREATE_CAT_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "name": "Ichimliklar $RAND_SUFFIX",
  "sortOrder": 1
}
EOF
)
  send_request "POST" "/categories" "$CREATE_CAT_PAYLOAD" "Kategoriya yaratish"
  CATEGORY_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

  if [ -n "$CATEGORY_ID" ]; then
    send_request "PUT" "/categories/$CATEGORY_ID" '{"name": "Salqin Ichimliklar"}' "Kategoriyani yangilash"
  fi

  send_request "GET" "/products?organizationId=$ORG_ID" "" "Mahsulotlar ro'yxatini olish"

  CREATE_PROD_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "categoryId": "$CATEGORY_ID",
  "name": "Cola 1.5L",
  "sku": "COLA-$RAND_SUFFIX",
  "barcode": "478000$RAND_SUFFIX",
  "unit": "dona",
  "salePrice": 12000,
  "costPrice": 9000,
  "minStock": 5
}
EOF
)
  send_request "POST" "/products" "$CREATE_PROD_PAYLOAD" "Mahsulot yaratish"
  PRODUCT_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

  if [ -n "$PRODUCT_ID" ]; then
    send_request "GET" "/products/$PRODUCT_ID" "" "Mahsulot tafsilotini olish"
    send_request "PUT" "/products/$PRODUCT_ID" '{"salePrice": 12500}' "Mahsulot narxini yangilash"
  fi
fi

# ----------------------------------------------------
# 5. Mijozlar va Yetkazib beruvchilar
# ----------------------------------------------------
if [ -n "$ORG_ID" ]; then
  send_request "GET" "/customers?organizationId=$ORG_ID" "" "Mijozlar ro'yxatini olish"

  CREATE_CUST_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "fullName": "Vali Aliyev",
  "phone": "+99894${RAND_SUFFIX}",
  "address": "Toshkent",
  "creditLimit": 1000000
}
EOF
)
  send_request "POST" "/customers" "$CREATE_CUST_PAYLOAD" "Mijoz yaratish"
  CUSTOMER_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

  if [ -n "$CUSTOMER_ID" ]; then
    send_request "GET" "/customers/$CUSTOMER_ID" "" "Mijoz tafsilotini olish"
    send_request "PUT" "/customers/$CUSTOMER_ID" '{"address": "Toshkent, Yunusobod"}' "Mijoz ma'lumotini yangilash"
    send_request "GET" "/customers/$CUSTOMER_ID/debt" "" "Mijoz qarzdorligini olish"
  fi

  send_request "GET" "/suppliers?organizationId=$ORG_ID" "" "Yetkazib beruvchilar ro'yxatini olish"

  CREATE_SUPP_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "name": "Distributor MChJ $RAND_SUFFIX",
  "phone": "+99895${RAND_SUFFIX}",
  "tin": "300123456"
}
EOF
)
  send_request "POST" "/suppliers" "$CREATE_SUPP_PAYLOAD" "Yetkazib beruvchi yaratish"
  SUPPLIER_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

  if [ -n "$SUPPLIER_ID" ]; then
    send_request "PUT" "/suppliers/$SUPPLIER_ID" '{"note": "Haftalik ta'minotchi"}' "Yetkazib beruvchini yangilash"
  fi
fi

# ----------------------------------------------------
# 6. Ombor (Inventory & Stock Documents)
# ----------------------------------------------------
if [ -n "$ORG_ID" ]; then
  send_request "GET" "/inventory/balances?organizationId=$ORG_ID" "" "Ombor qoldiqlarini olish"
  send_request "GET" "/inventory/movements?organizationId=$ORG_ID" "" "Ombor harakatlarini olish"
  send_request "GET" "/stock-documents?organizationId=$ORG_ID" "" "Ombor hujjatlarini olish"

  if [ -n "$STORE_ID" ] && [ -n "$PRODUCT_ID" ]; then
    CREATE_STOCK_DOC_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "storeId": "$STORE_ID",
  "supplierId": "$SUPPLIER_ID",
  "documentType": "purchase",
  "documentNo": "KIRIM-$RAND_SUFFIX",
  "note": "Boshlang'ich kirim",
  "items": [
    { "productId": "$PRODUCT_ID", "quantity": 100, "unitCost": 9000 }
  ]
}
EOF
)
    send_request "POST" "/stock-documents" "$CREATE_STOCK_DOC_PAYLOAD" "Ombor kirim hujjatini yaratish (Draft)"
    STOCK_DOC_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

    if [ -n "$STOCK_DOC_ID" ]; then
      send_request "GET" "/stock-documents/$STOCK_DOC_ID" "" "Ombor hujjatini ko'rish"
      send_request "POST" "/stock-documents/$STOCK_DOC_ID/confirm" "" "Ombor hujjatini tasdiqlash"
    fi
  fi
fi

# ----------------------------------------------------
# 7. Smena va Kassa
# ----------------------------------------------------
if [ -n "$REGISTER_ID" ]; then
  send_request "GET" "/shifts" "" "Smenalar ro'yxatini olish"

  OPEN_SHIFT_PAYLOAD=$(cat <<EOF
{
  "registerId": "$REGISTER_ID",
  "openingCash": 500000,
  "note": "Ertalabki smena"
}
EOF
)
  send_request "POST" "/shifts" "$OPEN_SHIFT_PAYLOAD" "Smena ochish"
  SHIFT_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

  if [ -n "$SHIFT_ID" ]; then
    send_request "GET" "/shifts/$SHIFT_ID" "" "Smena tafsilotini ko'rish"

    CASH_MOVE_PAYLOAD='{"movementType": "cash_in", "amount": 100000, "reason": "Mayda pul qo'shish"}'
    send_request "POST" "/shifts/$SHIFT_ID/cash-movements" "$CASH_MOVE_PAYLOAD" "Kassaga naqd pul kiritish"
  fi
fi

# ----------------------------------------------------
# 8. Savdolar va To'lovlar
# ----------------------------------------------------
if [ -n "$ORG_ID" ]; then
  send_request "GET" "/sales?organizationId=$ORG_ID" "" "Savdolar ro'yxatini olish"

  if [ -n "$STORE_ID" ] && [ -n "$REGISTER_ID" ] && [ -n "$SHIFT_ID" ] && [ -n "$PRODUCT_ID" ]; then
    CREATE_SALE_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "storeId": "$STORE_ID",
  "registerId": "$REGISTER_ID",
  "shiftId": "$SHIFT_ID",
  "customerId": "$CUSTOMER_ID",
  "discountAmount": 0,
  "items": [
    {
      "productId": "$PRODUCT_ID",
      "productName": "Cola 1.5L",
      "sku": "COLA-$RAND_SUFFIX",
      "quantity": 2,
      "unitPrice": 12500,
      "discountAmount": 0,
      "unitCost": 9000
    }
  ]
}
EOF
)
    send_request "POST" "/sales" "$CREATE_SALE_PAYLOAD" "Yangi savdo yaratish (Draft)"
    SALE_ID=$(echo "$LAST_RESPONSE" | grep -o '"id":"[^"]*' | head -n1 | grep -o '[^"]*$' || true)

    if [ -n "$SALE_ID" ]; then
      send_request "GET" "/sales/$SALE_ID" "" "Savdo tafsilotini olish"

      COMPLETE_SALE_PAYLOAD=$(cat <<EOF
{
  "payments": [
    { "paymentType": "cash", "amount": 25000 }
  ]
}
EOF
)
      send_request "POST" "/sales/$SALE_ID/complete" "$COMPLETE_SALE_PAYLOAD" "Savdoni yakunlash va to'lov qilish"
    fi
  fi

  send_request "GET" "/payments?organizationId=$ORG_ID" "" "To'lovlar ro'yxatini olish"

  if [ -n "$CUSTOMER_ID" ]; then
    CREDIT_PAY_PAYLOAD=$(cat <<EOF
{
  "organizationId": "$ORG_ID",
  "storeId": "$STORE_ID",
  "customerId": "$CUSTOMER_ID",
  "amount": 10000,
  "note": "Nasiya qarz to'lovi"
}
EOF
)
    send_request "POST" "/payments/credit" "$CREDIT_PAY_PAYLOAD" "Mijoz nasiya to'lovini qabul qilish"
  fi
fi

# ----------------------------------------------------
# 9. Hisobotlar
# ----------------------------------------------------
if [ -n "$ORG_ID" ]; then
  send_request "GET" "/reports/dashboard?organizationId=$ORG_ID" "" "Dashboard hisobotini olish"
  send_request "GET" "/reports/sales?organizationId=$ORG_ID" "" "Savdolar hisobotini olish"
  send_request "GET" "/reports/products?organizationId=$ORG_ID" "" "Mahsulotlar bo'yicha hisobotni olish"
fi

# Smenani yopish (test yakunida)
if [ -n "$SHIFT_ID" ]; then
  CLOSE_SHIFT_PAYLOAD='{"countedCash": 625000, "note": "Kassa smenasi yopildi"}'
  send_request "POST" "/shifts/$SHIFT_ID" "$CLOSE_SHIFT_PAYLOAD" "Smenani yopish"
fi

echo "=========================================="
echo "Test yakunlandi!"
echo "Muvaffaqiyatli so'rovlar: success.md fayliga yozildi."
echo "Xatoliklar: error.md fayliga yozildi."
echo "=========================================="