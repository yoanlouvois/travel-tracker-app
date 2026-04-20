# WorldTracker

WorldTracker is a web application that allows users to visualize and track their travels on an interactive world map.

It enables marking countries as visited or to visit, adding custom places, and creating roadtrips directly on the map.

---

## Features

- Interactive world map powered by Leaflet
- Mark countries as visited
- Mark countries as "to visit"
- Add custom places (cities, activities, viewpoints, etc.)
- Create roadtrips by connecting multiple locations
- Filter display of places and countries
- Dynamic info panel for countries, places, and roadtrips
- Backend persistence using a database

---
<p align="center">
  <img src="https://github.com/user-attachments/assets/2ea18257-d25c-4e40-a4d7-6f54d210378b" width="45%" />
  <img src="https://github.com/user-attachments/assets/219604cd-bbb5-4e47-a98a-f1d6ca661918" width="45%" />
</p>

---

## Tech Stack

### Frontend
- JavaScript
- Leaflet
- HTML / CSS

### Backend
- Node.js (Express)
- Prisma ORM
- SQLite

---

## Getting Started

### 1. Clone the repository

git clone <your-repo-url>  
cd WorldTracker

### 2. Install dependencies

`npm install`

### 3. Setup the database

`npx prisma generate`
`npx prisma migrate dev` 
`npm run seed:countries`

### 4. Start the server

`npm start`

Then open your browser at:

`http://localhost:8080`
