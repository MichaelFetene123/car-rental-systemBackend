# Car Rental Booking API Design

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [API Endpoints](#api-endpoints)
5. [Complete Booking Flow](#complete-booking-flow)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)

---

## Overview

This API provides endpoints for managing car rentals, from searching available vehicles to completing bookings and payments.

### API Version
- Version: `v1`
- Format: JSON
- Protocol: HTTPS only

---

## Authentication

All endpoints require authentication except public search endpoints.

### Authentication Methods

**Bearer Token (JWT)**
```http
Authorization: Bearer {token}
```

**API Key (for integrations)**
```http
X-API-Key: {api_key}
```

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new customer account.

**Request:**
```json
{
  "full_name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "password": "SecureP@ssw0rd"
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "status": "active",
      "created_at": "2026-03-09T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

#### POST /api/v1/auth/login
Login to get access token.

**Request:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecureP@ssw0rd"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

#### POST /api/v1/auth/refresh
Refresh expired access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

---

## Base URL

```
Production: https://api.carrental.com/v1
Staging: https://api-staging.carrental.com/v1
Development: http://localhost:3000/api/v1
```

---

## API Endpoints

### 1. Locations

#### GET /api/v1/locations
Get all active rental locations.

**Query Parameters:**
- `city` (optional) - Filter by city
- `state` (optional) - Filter by state
- `is_active` (optional) - Filter by active status (default: true)

**Request:**
```http
GET /api/v1/locations?city=New York&is_active=true
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "name": "New York Downtown",
      "address": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001",
      "phone": "+1-212-555-0100",
      "email": "nydowntown@carrental.com",
      "opening_hours": "Mon-Fri: 8AM-8PM, Sat-Sun: 9AM-6PM",
      "is_active": true
    },
    {
      "id": "650e8400-e29b-41d4-a716-446655440002",
      "name": "New York JFK Airport",
      "address": "JFK Airport Terminal 4",
      "city": "New York",
      "state": "NY",
      "zip_code": "11430",
      "phone": "+1-718-555-0200",
      "email": "jfk@carrental.com",
      "opening_hours": "24/7",
      "is_active": true
    }
  ],
  "meta": {
    "total": 2,
    "count": 2
  }
}
```

#### GET /api/v1/locations/:id
Get location details by ID.

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "New York Downtown",
    "address": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zip_code": "10001",
    "phone": "+1-212-555-0100",
    "email": "nydowntown@carrental.com",
    "opening_hours": "Mon-Fri: 8AM-8PM, Sat-Sun: 9AM-6PM",
    "is_active": true,
    "available_cars_count": 45
  }
}
```

---

### 2. Categories

#### GET /api/v1/categories
Get all active car categories.

**Query Parameters:**
- `is_active` (optional) - Filter by active status (default: true)
- `include_features` (optional) - Include category features (default: false)

**Request:**
```http
GET /api/v1/categories?include_features=true
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440001",
      "name": "Luxury",
      "slug": "luxury",
      "description": "Premium vehicles with high-end features and exceptional comfort.",
      "min_daily_rate": 150.00,
      "max_daily_rate": 350.00,
      "display_order": 5,
      "vehicle_count": 8,
      "is_active": true,
      "features": [
        {
          "id": "850e8400-e29b-41d4-a716-446655440001",
          "feature_name": "Premium Interior",
          "icon": "✨",
          "description": "High-quality leather seats and finishes",
          "is_standard": true
        },
        {
          "id": "850e8400-e29b-41d4-a716-446655440002",
          "feature_name": "Advanced Tech",
          "icon": "📱",
          "description": "Latest infotainment and driver assistance",
          "is_standard": true
        }
      ],
      "meta_data": {
        "ideal_for": "Business travel, Special occasions",
        "passenger_capacity": "2-5"
      }
    }
  ],
  "meta": {
    "total": 6,
    "count": 6
  }
}
```

#### GET /api/v1/categories/:slug
Get category details by slug.

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440001",
    "name": "Luxury",
    "slug": "luxury",
    "description": "Premium vehicles with high-end features and exceptional comfort.",
    "min_daily_rate": 150.00,
    "max_daily_rate": 350.00,
    "vehicle_count": 8,
    "features": [...],
    "available_cars": 5
  }
}
```

---

### 3. Cars

#### GET /api/v1/cars
Search available cars with filters.

**Query Parameters:**
- `category_id` (optional) - Filter by category UUID
- `category_slug` (optional) - Filter by category slug
- `location_id` (optional) - Filter by location
- `pickup_date` (optional) - Pickup date (ISO 8601)
- `return_date` (optional) - Return date (ISO 8601)
- `min_price` (optional) - Minimum daily price
- `max_price` (optional) - Maximum daily price
- `seats` (optional) - Minimum number of seats
- `transmission` (optional) - Filter by transmission type
- `fuel_type` (optional) - Filter by fuel type
- `status` (optional) - Filter by status (default: available)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20, max: 100)
- `sort_by` (optional) - Sort field (price_asc, price_desc, name_asc, name_desc, year_desc)

**Request:**
```http
GET /api/v1/cars?category_slug=luxury&pickup_date=2026-03-15T10:00:00Z&return_date=2026-03-20T10:00:00Z&min_price=100&max_price=300&transmission=automatic&page=1&limit=10&sort_by=price_asc
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "450e8400-e29b-41d4-a716-446655440001",
      "name": "BMW 7 Series 2024",
      "category": {
        "id": "750e8400-e29b-41d4-a716-446655440001",
        "name": "Luxury",
        "slug": "luxury"
      },
      "year": 2024,
      "seats": 5,
      "fuel_type": "Gasoline",
      "transmission": "Automatic",
      "price_per_day": 250.00,
      "status": "available",
      "is_available": true,
      "image_url": "https://cdn.carrental.com/cars/bmw-7-series.jpg",
      "description": "Experience ultimate luxury with the BMW 7 Series.",
      "home_location": {
        "id": "650e8400-e29b-41d4-a716-446655440001",
        "name": "New York Downtown",
        "city": "New York",
        "state": "NY"
      }
    }
  ],
  "meta": {
    "total": 5,
    "count": 5,
    "page": 1,
    "limit": 10,
    "pages": 1
  },
  "filters_applied": {
    "category_slug": "luxury",
    "pickup_date": "2026-03-15T10:00:00Z",
    "return_date": "2026-03-20T10:00:00Z",
    "min_price": 100,
    "max_price": 300,
    "transmission": "automatic"
  }
}
```

#### GET /api/v1/cars/:id
Get car details by ID.

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "450e8400-e29b-41d4-a716-446655440001",
    "name": "BMW 7 Series 2024",
    "category": {
      "id": "750e8400-e29b-41d4-a716-446655440001",
      "name": "Luxury",
      "slug": "luxury",
      "features": [
        "Premium Interior",
        "Advanced Tech",
        "High Performance"
      ]
    },
    "year": 2024,
    "seats": 5,
    "fuel_type": "Gasoline",
    "transmission": "Automatic",
    "price_per_day": 250.00,
    "status": "available",
    "is_available": true,
    "image_url": "https://cdn.carrental.com/cars/bmw-7-series.jpg",
    "description": "Experience ultimate luxury with the BMW 7 Series featuring premium leather interior, advanced safety systems, and powerful performance.",
    "home_location": {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "name": "New York Downtown",
      "address": "123 Main Street",
      "city": "New York",
      "state": "NY"
    },
    "specifications": {
      "engine": "3.0L Turbocharged Inline-6",
      "horsepower": "335 hp",
      "mpg_city": 22,
      "mpg_highway": 29,
      "trunk_capacity": "18.2 cubic feet"
    },
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-03-01T14:30:00Z"
  }
}
```

#### POST /api/v1/cars/:id/check-availability
Check if a car is available for specific dates.

**Authentication:** Optional (better rates for authenticated users)

**Request:**
```json
{
  "pickup_date": "2026-03-15T10:00:00Z",
  "return_date": "2026-03-20T10:00:00Z",
  "pickup_location_id": "650e8400-e29b-41d4-a716-446655440001",
  "return_location_id": "650e8400-e29b-41d4-a716-446655440001"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "available": true,
    "car_id": "450e8400-e29b-41d4-a716-446655440001",
    "car_name": "BMW 7 Series 2024",
    "pickup_date": "2026-03-15T10:00:00Z",
    "return_date": "2026-03-20T10:00:00Z",
    "rental_days": 5,
    "pricing": {
      "daily_rate": 250.00,
      "subtotal": 1250.00,
      "tax": 125.00,
      "fees": 25.00,
      "total_amount": 1400.00,
      "currency": "USD"
    },
    "pricing_breakdown": [
      {
        "description": "5 days rental @ $250/day",
        "amount": 1250.00
      },
      {
        "description": "Tax (10%)",
        "amount": 125.00
      },
      {
        "description": "Service fee",
        "amount": 25.00
      }
    ],
    "available_locations": {
      "pickup": {
        "id": "650e8400-e29b-41d4-a716-446655440001",
        "name": "New York Downtown",
        "opening_hours": "Mon-Fri: 8AM-8PM"
      },
      "return": {
        "id": "650e8400-e29b-41d4-a716-446655440001",
        "name": "New York Downtown",
        "opening_hours": "Mon-Fri: 8AM-8PM"
      }
    }
  }
}
```

**Response: 200 OK (Not Available)**
```json
{
  "success": true,
  "data": {
    "available": false,
    "car_id": "450e8400-e29b-41d4-a716-446655440001",
    "reason": "Car already booked for selected dates",
    "conflicting_bookings": [
      {
        "pickup_date": "2026-03-14T10:00:00Z",
        "return_date": "2026-03-18T10:00:00Z"
      }
    ],
    "next_available_date": "2026-03-19T10:00:00Z",
    "similar_cars": [
      {
        "id": "450e8400-e29b-41d4-a716-446655440002",
        "name": "Mercedes S-Class 2024",
        "price_per_day": 275.00,
        "available": true
      }
    ]
  }
}
```

---

### 4. Bookings

#### POST /api/v1/bookings
Create a new booking.

**Authentication:** Required

**Request:**
```json
{
  "car_id": "450e8400-e29b-41d4-a716-446655440001",
  "pickup_location_id": "650e8400-e29b-41d4-a716-446655440001",
  "return_location_id": "650e8400-e29b-41d4-a716-446655440001",
  "pickup_at": "2026-03-15T10:00:00Z",
  "return_at": "2026-03-20T10:00:00Z",
  "additional_notes": "Need child car seat for 3 year old"
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "350e8400-e29b-41d4-a716-446655440001",
    "booking_code": "BK-2026-0309-001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "car": {
      "id": "450e8400-e29b-41d4-a716-446655440001",
      "name": "BMW 7 Series 2024",
      "category": "Luxury",
      "year": 2024,
      "image_url": "https://cdn.carrental.com/cars/bmw-7-series.jpg"
    },
    "pickup_location": {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "name": "New York Downtown",
      "address": "123 Main Street",
      "city": "New York",
      "state": "NY"
    },
    "return_location": {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "name": "New York Downtown",
      "address": "123 Main Street",
      "city": "New York",
      "state": "NY"
    },
    "pickup_at": "2026-03-15T10:00:00Z",
    "return_at": "2026-03-20T10:00:00Z",
    "rental_days": 5,
    "status": "pending",
    "total_amount": 1400.00,
    "pricing_breakdown": {
      "daily_rate": 250.00,
      "rental_days": 5,
      "subtotal": 1250.00,
      "tax": 125.00,
      "fees": 25.00,
      "total": 1400.00
    },
    "booked_at": "2026-03-09T10:30:00Z",
    "expires_at": "2026-03-09T11:00:00Z",
    "payment_required": true,
    "payment_deadline": "2026-03-09T11:00:00Z"
  }
}
```

**Error Response: 400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "CAR_NOT_AVAILABLE",
    "message": "The selected car is not available for the requested dates",
    "details": {
      "car_id": "450e8400-e29b-41d4-a716-446655440001",
      "requested_pickup": "2026-03-15T10:00:00Z",
      "requested_return": "2026-03-20T10:00:00Z",
      "conflicting_booking": "BK-2026-0308-045"
    }
  }
}
```

**Validation Errors: 422 Unprocessable Entity**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "validation_errors": [
      {
        "field": "pickup_at",
        "message": "Pickup date must be in the future"
      },
      {
        "field": "return_at",
        "message": "Return date must be after pickup date"
      },
      {
        "field": "car_id",
        "message": "Invalid car ID format"
      }
    ]
  }
}
```

#### GET /api/v1/bookings
Get all bookings for the authenticated user.

**Authentication:** Required

**Query Parameters:**
- `status` (optional) - Filter by status (pending, confirmed, approved, cancelled, completed)
- `from_date` (optional) - Filter bookings from this date
- `to_date` (optional) - Filter bookings until this date
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10, max: 50)
- `sort_by` (optional) - Sort by (booked_at_desc, booked_at_asc, pickup_at_desc, pickup_at_asc)

**Request:**
```http
GET /api/v1/bookings?status=confirmed&page=1&limit=10&sort_by=pickup_at_desc
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "350e8400-e29b-41d4-a716-446655440001",
      "booking_code": "BK-2026-0309-001",
      "car": {
        "id": "450e8400-e29b-41d4-a716-446655440001",
        "name": "BMW 7 Series 2024",
        "category": "Luxury",
        "year": 2024,
        "image_url": "https://cdn.carrental.com/cars/bmw-7-series.jpg"
      },
      "pickup_location": {
        "name": "New York Downtown",
        "city": "New York",
        "state": "NY"
      },
      "return_location": {
        "name": "New York Downtown",
        "city": "New York",
        "state": "NY"
      },
      "pickup_at": "2026-03-15T10:00:00Z",
      "return_at": "2026-03-20T10:00:00Z",
      "status": "confirmed",
      "total_amount": 1400.00,
      "payment_status": "paid",
      "booked_at": "2026-03-09T10:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "count": 10,
    "page": 1,
    "limit": 10,
    "pages": 2
  }
}
```

#### GET /api/v1/bookings/:id
Get booking details by ID.

**Authentication:** Required (must be owner or admin)

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "350e8400-e29b-41d4-a716-446655440001",
    "booking_code": "BK-2026-0309-001",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890"
    },
    "car": {
      "id": "450e8400-e29b-41d4-a716-446655440001",
      "name": "BMW 7 Series 2024",
      "category": "Luxury",
      "year": 2024,
      "seats": 5,
      "transmission": "Automatic",
      "fuel_type": "Gasoline",
      "image_url": "https://cdn.carrental.com/cars/bmw-7-series.jpg"
    },
    "pickup_location": {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "name": "New York Downtown",
      "address": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "phone": "+1-212-555-0100",
      "opening_hours": "Mon-Fri: 8AM-8PM"
    },
    "return_location": {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "name": "New York Downtown",
      "address": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "phone": "+1-212-555-0100",
      "opening_hours": "Mon-Fri: 8AM-8PM"
    },
    "pickup_at": "2026-03-15T10:00:00Z",
    "return_at": "2026-03-20T10:00:00Z",
    "rental_days": 5,
    "status": "confirmed",
    "total_amount": 1400.00,
    "pricing_breakdown": {
      "daily_rate": 250.00,
      "rental_days": 5,
      "subtotal": 1250.00,
      "tax": 125.00,
      "fees": 25.00,
      "discount": 0.00,
      "total": 1400.00
    },
    "payment": {
      "id": "250e8400-e29b-41d4-a716-446655440001",
      "invoice_number": "INV-2026-0309-001",
      "amount": 1400.00,
      "method": "credit_card",
      "status": "completed",
      "paid_at": "2026-03-09T10:35:00Z"
    },
    "booked_at": "2026-03-09T10:30:00Z",
    "confirmed_at": "2026-03-09T10:35:00Z",
    "can_modify": true,
    "can_cancel": true,
    "modification_deadline": "2026-03-14T10:00:00Z",
    "cancellation_policy": "Free cancellation up to 24 hours before pickup"
  }
}
```

#### PATCH /api/v1/bookings/:id
Update/Modify a booking.

**Authentication:** Required (must be owner or admin)

**Request:**
```json
{
  "pickup_at": "2026-03-16T10:00:00Z",
  "return_at": "2026-03-21T10:00:00Z",
  "pickup_location_id": "650e8400-e29b-41d4-a716-446655440002",
  "return_location_id": "650e8400-e29b-41d4-a716-446655440002"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Booking updated successfully",
  "data": {
    "id": "350e8400-e29b-41d4-a716-446655440001",
    "booking_code": "BK-2026-0309-001",
    "status": "confirmed",
    "pickup_at": "2026-03-16T10:00:00Z",
    "return_at": "2026-03-21T10:00:00Z",
    "rental_days": 5,
    "total_amount": 1450.00,
    "amount_difference": 50.00,
    "modification_fee": 0.00,
    "updated_at": "2026-03-09T11:00:00Z",
    "requires_additional_payment": true,
    "payment_due": 50.00
  }
}
```

**Error Response: 400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "MODIFICATION_NOT_ALLOWED",
    "message": "Booking cannot be modified within 24 hours of pickup time",
    "details": {
      "pickup_at": "2026-03-15T10:00:00Z",
      "current_time": "2026-03-14T12:00:00Z",
      "modification_deadline": "2026-03-14T10:00:00Z"
    }
  }
}
```

#### DELETE /api/v1/bookings/:id
Cancel/Delete a booking.

**Authentication:** Required (must be owner or admin)

**Request (Optional body for cancellation reason):**
```json
{
  "reason": "Change of travel plans",
  "request_refund": true
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "id": "350e8400-e29b-41d4-a716-446655440001",
    "booking_code": "BK-2026-0309-001",
    "status": "cancelled",
    "cancelled_at": "2026-03-09T11:30:00Z",
    "refund": {
      "eligible": true,
      "amount": 1400.00,
      "processing_time": "5-7 business days",
      "method": "Original payment method"
    },
    "cancellation_fee": 0.00
  }
}
```

**Error Response: 400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "CANCELLATION_NOT_ALLOWED",
    "message": "Booking cannot be cancelled. Rental has already started.",
    "details": {
      "pickup_at": "2026-03-09T09:00:00Z",
      "current_time": "2026-03-09T11:30:00Z",
      "booking_status": "active"
    }
  }
}
```

---

### 5. Payments

#### POST /api/v1/payments
Create a payment for a booking.

**Authentication:** Required

**Request:**
```json
{
  "booking_id": "350e8400-e29b-41d4-a716-446655440001",
  "amount": 1400.00,
  "method": "credit_card",
  "payment_details": {
    "card_number": "4242424242424242",
    "card_holder": "John Doe",
    "expiry_month": "12",
    "expiry_year": "2028",
    "cvv": "123",
    "billing_address": {
      "street": "456 Park Avenue",
      "city": "New York",
      "state": "NY",
      "zip_code": "10022",
      "country": "US"
    }
  }
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "id": "250e8400-e29b-41d4-a716-446655440001",
    "booking_id": "350e8400-e29b-41d4-a716-446655440001",
    "invoice_number": "INV-2026-0309-001",
    "transaction_id": "txn_1JK7xYHABC123DEF456",
    "amount": 1400.00,
    "tax": 125.00,
    "fees": 25.00,
    "method": "credit_card",
    "status": "completed",
    "paid_at": "2026-03-09T10:35:00Z",
    "receipt_url": "https://api.carrental.com/receipts/INV-2026-0309-001.pdf"
  }
}
```

**Error Response: 402 Payment Required**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "Payment could not be processed",
    "details": {
      "reason": "Insufficient funds",
      "gateway_code": "insufficient_funds",
      "gateway_message": "Your card has insufficient funds"
    }
  }
}
```

#### GET /api/v1/payments/:id
Get payment details.

**Authentication:** Required (must be owner or admin)

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "250e8400-e29b-41d4-a716-446655440001",
    "booking_id": "350e8400-e29b-41d4-a716-446655440001",
    "booking_code": "BK-2026-0309-001",
    "invoice_number": "INV-2026-0309-001",
    "transaction_id": "txn_1JK7xYHABC123DEF456",
    "amount": 1400.00,
    "tax": 125.00,
    "fees": 25.00,
    "method": "credit_card",
    "status": "completed",
    "paid_at": "2026-03-09T10:35:00Z",
    "card_last4": "4242",
    "card_brand": "visa",
    "receipt_url": "https://api.carrental.com/receipts/INV-2026-0309-001.pdf",
    "created_at": "2026-03-09T10:35:00Z"
  }
}
```

#### GET /api/v1/bookings/:booking_id/payments
Get all payments for a booking.

**Authentication:** Required

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "250e8400-e29b-41d4-a716-446655440001",
      "invoice_number": "INV-2026-0309-001",
      "amount": 1400.00,
      "method": "credit_card",
      "status": "completed",
      "paid_at": "2026-03-09T10:35:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "total_paid": 1400.00,
    "total_refunded": 0.00
  }
}
```

#### POST /api/v1/payments/:id/refund
Request a refund for a payment.

**Authentication:** Required (must be owner or admin)

**Request:**
```json
{
  "amount": 1400.00,
  "reason": "Booking cancelled due to car unavailability"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "refund_id": "rf_1JK8xYHABC123DEF456",
    "payment_id": "250e8400-e29b-41d4-a716-446655440001",
    "amount": 1400.00,
    "status": "completed",
    "reason": "Booking cancelled due to car unavailability",
    "processed_at": "2026-03-09T12:00:00Z",
    "estimated_arrival": "2026-03-14T00:00:00Z"
  }
}
```

---

### 6. Price Calculation

#### POST /api/v1/calculate-price
Calculate rental price for given parameters.

**Authentication:** Optional (logged in users may get better rates)

**Request:**
```json
{
  "car_id": "450e8400-e29b-41d4-a716-446655440001",
  "pickup_date": "2026-03-15T10:00:00Z",
  "return_date": "2026-03-20T10:00:00Z",
  "pickup_location_id": "650e8400-e29b-41d4-a716-446655440001",
  "return_location_id": "650e8400-e29b-41d4-a716-446655440002",
  "discount_code": "SPRING2026"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "car_id": "450e8400-e29b-41d4-a716-446655440001",
    "car_name": "BMW 7 Series 2024",
    "rental_period": {
      "pickup_date": "2026-03-15T10:00:00Z",
      "return_date": "2026-03-20T10:00:00Z",
      "rental_days": 5
    },
    "pricing": {
      "daily_rate": 250.00,
      "base_cost": 1250.00,
      "location_fee": 50.00,
      "subtotal": 1300.00,
      "discount": 130.00,
      "discount_details": {
        "code": "SPRING2026",
        "type": "percentage",
        "value": 10
      },
      "tax_rate": 10,
      "tax": 117.00,
      "service_fee": 25.00,
      "total_amount": 1312.00,
      "currency": "USD"
    },
    "breakdown": [
      { "item": "Daily rate (5 days × $250)", "amount": 1250.00 },
      { "item": "Different return location", "amount": 50.00 },
      { "item": "Discount (SPRING2026 - 10%)", "amount": -130.00 },
      { "item": "Tax (10%)", "amount": 117.00 },
      { "item": "Service fee", "amount": 25.00 },
      { "item": "Total", "amount": 1312.00, "bold": true }
    ]
  }
}
```

---

## Complete Booking Flow

### Flow Diagram

```
1. Search Cars
   └─> GET /api/v1/cars?category=luxury&pickup_date=...

2. View Car Details
   └─> GET /api/v1/cars/:id

3. Check Availability
   └─> POST /api/v1/cars/:id/check-availability

4. Calculate Price (Optional)
   └─> POST /api/v1/calculate-price

5. User Authentication
   ├─> New User: POST /api/v1/auth/register
   └─> Existing User: POST /api/v1/auth/login

6. Create Booking
   └─> POST /api/v1/bookings
       └─> Returns booking with "pending" status

7. Process Payment
   └─> POST /api/v1/payments
       └─> Booking status changes to "confirmed"

8. View Booking Confirmation
   └─> GET /api/v1/bookings/:id

9. (Optional) Modify Booking
   └─> PATCH /api/v1/bookings/:id

10. (Optional) Cancel Booking
    └─> DELETE /api/v1/bookings/:id
        └─> POST /api/v1/payments/:id/refund (if applicable)
```

### Step-by-Step Example

#### Step 1: Search for Available Cars
```http
GET /api/v1/cars?category_slug=luxury&pickup_date=2026-03-15T10:00:00Z&return_date=2026-03-20T10:00:00Z
```

#### Step 2: Check Specific Car Availability
```http
POST /api/v1/cars/450e8400-e29b-41d4-a716-446655440001/check-availability
Content-Type: application/json

{
  "pickup_date": "2026-03-15T10:00:00Z",
  "return_date": "2026-03-20T10:00:00Z",
  "pickup_location_id": "650e8400-e29b-41d4-a716-446655440001",
  "return_location_id": "650e8400-e29b-41d4-a716-446655440001"
}
```

#### Step 3: User Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecureP@ssw0rd"
}
```

#### Step 4: Create Booking
```http
POST /api/v1/bookings
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "car_id": "450e8400-e29b-41d4-a716-446655440001",
  "pickup_location_id": "650e8400-e29b-41d4-a716-446655440001",
  "return_location_id": "650e8400-e29b-41d4-a716-446655440001",
  "pickup_at": "2026-03-15T10:00:00Z",
  "return_at": "2026-03-20T10:00:00Z"
}
```

#### Step 5: Process Payment
```http
POST /api/v1/payments
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "booking_id": "350e8400-e29b-41d4-a716-446655440001",
  "amount": 1400.00,
  "method": "credit_card",
  "payment_details": {
    "card_number": "4242424242424242",
    "card_holder": "John Doe",
    "expiry_month": "12",
    "expiry_year": "2028",
    "cvv": "123"
  }
}
```

#### Step 6: Get Booking Confirmation
```http
GET /api/v1/bookings/350e8400-e29b-41d4-a716-446655440001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "additional": "context information"
    }
  }
}
```

### HTTP Status Codes

| Status Code | Description | Usage |
|-------------|-------------|-------|
| 200 | OK | Successful GET, PATCH, DELETE requests |
| 201 | Created | Successful POST request creating a resource |
| 400 | Bad Request | Invalid request parameters or business logic error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized for this action |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource conflict (e.g., duplicate booking) |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Payment gateway or external service error |
| 503 | Service Unavailable | Temporary service outage |

### Common Error Codes

| Error Code | Description |
|------------|-------------|
| `AUTHENTICATION_REQUIRED` | User must be logged in |
| `INVALID_TOKEN` | JWT token is invalid or expired |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `VALIDATION_ERROR` | Request validation failed |
| `CAR_NOT_FOUND` | Requested car does not exist |
| `CAR_NOT_AVAILABLE` | Car is not available for booking |
| `BOOKING_NOT_FOUND` | Booking does not exist |
| `BOOKING_EXPIRED` | Booking has expired |
| `MODIFICATION_NOT_ALLOWED` | Booking cannot be modified |
| `CANCELLATION_NOT_ALLOWED` | Booking cannot be cancelled |
| `PAYMENT_REQUIRED` | Payment is required to proceed |
| `PAYMENT_FAILED` | Payment processing failed |
| `INVALID_DATES` | Invalid pickup/return dates |
| `LOCATION_NOT_FOUND` | Location does not exist |
| `DISCOUNT_CODE_INVALID` | Invalid or expired discount code |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---

## Rate Limiting

### Limits

- **Unauthenticated requests:** 100 requests per hour per IP
- **Authenticated requests:** 1000 requests per hour per user
- **Booking creation:** 10 requests per hour per user
- **Payment processing:** 5 requests per hour per user

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1678363200
```

### Rate Limit Exceeded Response

**Status: 429 Too Many Requests**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2026-03-09T11:00:00Z"
    }
  }
}
```

---

## Webhooks (Optional)

For integration partners, webhooks can be configured to receive real-time updates.

### Webhook Events

- `booking.created` - New booking created
- `booking.confirmed` - Booking confirmed after payment
- `booking.modified` - Booking details changed
- `booking.cancelled` - Booking cancelled
- `payment.completed` - Payment successfully processed
- `payment.failed` - Payment processing failed
- `payment.refunded` - Payment refunded

### Webhook Payload Example

```json
{
  "event": "booking.confirmed",
  "timestamp": "2026-03-09T10:35:00Z",
  "data": {
    "booking_id": "350e8400-e29b-41d4-a716-446655440001",
    "booking_code": "BK-2026-0309-001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "car_id": "450e8400-e29b-41d4-a716-446655440001",
    "status": "confirmed",
    "total_amount": 1400.00
  }
}
```

---

## Best Practices

1. **Always validate dates** - Ensure pickup is in the future and return is after pickup
2. **Check availability before booking** - Use the check-availability endpoint
3. **Handle payment failures gracefully** - Provide clear error messages
4. **Store tokens securely** - Never expose JWT tokens in logs or URLs
5. **Implement retry logic** - For failed payment processing
6. **Cache category and location data** - These change infrequently
7. **Use pagination** - For large result sets
8. **Implement proper error handling** - Check HTTP status codes and error responses
9. **Respect rate limits** - Implement exponential backoff
10. **Use HTTPS** - All API calls must use HTTPS in production

---

## Postman Collection

A complete Postman collection with all endpoints and example requests is available at:
```
https://api.carrental.com/postman/car-rental-api.json
```

---

## Support

For API support and questions:
- Email: api-support@carrental.com
- Documentation: https://docs.carrental.com
- Status Page: https://status.carrental.com
