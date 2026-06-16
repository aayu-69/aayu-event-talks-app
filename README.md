# BigQuery Release Radar 🚀

A modern, glassmorphic web application built with Python Flask and plain vanilla HTML, CSS, and JavaScript. The application fetches, parses, and displays the official Google Cloud BigQuery Release Notes, allowing you to search, filter, and draft tweets about specific updates instantly.

---

## 💻 Tech Stack
- **Backend**: Python 3.14+, Flask, Requests
- **Frontend**: Vanilla HTML5, CSS3 (CSS Grid & Flexbox, Glassmorphism), JavaScript (ES6)
- **APIs & Feeds**: Atom XML Release Notes Feed, Twitter/X Web Intent Share API

---

## ✨ Features
- **Atom Feed Ingestion**: Connects to the official Google Cloud BigQuery release feed.
- **Granular Update Decomposition**: Parses entry HTML and splits combined daily logs into standalone cards categorized by type (Feature, Change, Issue, General).
- **In-Memory Cache**: Implements a 5-minute server-side memory caching mechanism to reduce redundant external requests.
- **One-Click Share to X (Twitter)**: Highlights a selected update card and populates a tweet draft in a local visual composer, featuring:
  - Dynamic character count validation (280 characters limit).
  - SVG animated progress ring.
  - Quick actions to Copy Text or Post directly to X via a prefilled Web Intent popup.
- **Instant Search & Filter**: Real-time fuzzy keyword search and filter tabs to quickly isolate specific features, changes, or issues.
- **Responsive Premium Theme**: A dark-mode, glassmorphic interface that optimizes layout scaling for desktop, tablet, and mobile screens.

---

## 📂 Project Structure
- `app.py`: Flask server, XML parsing logic, and caching coordination.
- `requirements.txt`: Python package dependencies.
- `.gitignore`: Rules mapping excluded file paths (virtual environments, cache, system logs).
- `templates/`
  - `index.html`: Main HTML document detailing structure and layout containers.
- `static/`
  - `style.css`: Theme styles, variables, transitions, animations, and layouts.
  - `app.js`: Client-side controllers, API integrations, and event handling.

---

## 🚀 Getting Started

### 1. Prerequisites
Make sure you have Python 3.9+ installed.

### 2. Setup & Virtual Environment
Clone the repository and navigate into the project folder, then set up the virtual environment:

```powershell
# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r requirements.txt
```

### 3. Running the Server
Run the Flask application locally:

```powershell
python app.py
```

Open your browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.
