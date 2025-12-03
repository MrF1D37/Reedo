# Reedo - Book Recommendation Frontend

A simple, clean HTML/CSS/JavaScript frontend for the Book Recommender API.

## Features

- 🔐 **User Authentication**: Sign up and login
- 📚 **Browse Books**: Search and filter books by title, author, and genre
- ⭐ **Get Recommendations**: Personalized book recommendations based on your interactions
- 👤 **User Profile**: Update your reading preferences (genres, authors, etc.)
- 💬 **Interactions**: Like, view, and rate books to improve recommendations

## Setup

1. **Make sure the backend is running**:
   ```bash
   cd ../reccommender
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. **Open the frontend**:
   - Simply open `index.html` in your web browser
   - Or use a local server (recommended):
     ```bash
     # Using Python
     python3 -m http.server 8080
     
     # Then open http://localhost:8080 in your browser
     ```

## Configuration

The frontend is configured to connect to `http://127.0.0.1:8000` by default (the FastAPI backend).

To change the API URL, edit `app.js`:
```javascript
const API_BASE_URL = 'http://your-backend-url:8000';
```

## Usage

1. **Sign Up / Login**: Click the "Login" button to create an account or sign in
2. **Browse Books**: Use the search and filters to find books you're interested in
3. **Interact with Books**: Click "View", "Like", or "Rate" on books to build your profile
4. **Get Recommendations**: Visit "My Recommendations" to see personalized suggestions
5. **Update Preferences**: Go to "Profile" to set your favorite genres and authors

## API Endpoints Used

- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login
- `GET /books/` - List books with search/filter
- `GET /books/{id}` - Get book details
- `POST /interactions/` - Record user interactions
- `POST /recommend/` - Get recommendations
- `GET /users/me` - Get current user profile
- `PUT /users/me/preferences` - Update preferences

## File Structure

```
Reedo/
├── index.html      # Main HTML structure
├── styles.css      # Styling
├── app.js          # JavaScript logic and API calls
└── README.md       # This file
```

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge).
