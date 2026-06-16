import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION = 300  # 5 minutes in seconds

# Simple in-memory cache
feed_cache = {
    "data": None,
    "timestamp": 0
}

def parse_xml_feed(xml_content):
    root = ET.fromstring(xml_content)
    # The feed uses the Atom namespace
    namespace = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry in root.findall('atom:entry', namespace):
        title_el = entry.find('atom:title', namespace)
        date_str = title_el.text if title_el is not None else "Unknown Date"
        
        id_el = entry.find('atom:id', namespace)
        entry_id = id_el.text if id_el is not None else ""
        
        # Link mapping
        link_el = entry.find('atom:link[@rel="alternate"]', namespace)
        if link_el is None:
            link_el = entry.find('atom:link', namespace)
        link_href = link_el.attrib.get('href', '') if link_el is not None else ""
        
        content_el = entry.find('atom:content', namespace)
        html_content = content_el.text if content_el is not None else ""
        
        # Parse individual updates from the HTML content
        updates = []
        if html_content:
            # Split the content by <h3> headers
            parts = re.split(r'<h3>(.*?)</h3>', html_content)
            
            # parts[0] contains any text before the first <h3>
            preamble = parts[0].strip()
            if preamble:
                plain_text = re.sub(r'<[^>]+>', '', preamble)
                plain_text = " ".join(plain_text.split())
                if plain_text:
                    updates.append({
                        'type': 'General',
                        'html': preamble,
                        'text': plain_text
                    })
            
            # The remaining parts alternate: type, content, type, content...
            for i in range(1, len(parts), 2):
                if i + 1 < len(parts):
                    update_type = parts[i].strip()
                    update_html = parts[i+1].strip()
                    
                    # Strip HTML tags to get plain text for search and tweet body
                    plain_text = re.sub(r'<[^>]+>', '', update_html)
                    plain_text = " ".join(plain_text.split())
                    
                    updates.append({
                        'type': update_type,
                        'html': f"<h3>{update_type}</h3>{update_html}",
                        'text': plain_text
                    })
        else:
            updates.append({
                'type': 'General',
                'html': '<p>No content details found.</p>',
                'text': 'No content details found.'
            })
            
        entries.append({
            'date': date_str,
            'id': entry_id,
            'link': link_href,
            'updates': updates
        })
        
    return entries

def get_release_notes(force_refresh=False):
    now = time.time()
    
    # Check cache validity
    if not force_refresh and feed_cache["data"] and (now - feed_cache["timestamp"] < CACHE_DURATION):
        return feed_cache["data"], False
        
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=10)
        response.raise_for_status()
        
        parsed_entries = parse_xml_feed(response.content)
        
        # Update cache
        feed_cache["data"] = parsed_entries
        feed_cache["timestamp"] = now
        return parsed_entries, False
        
    except Exception as e:
        print(f"Error fetching release notes: {e}")
        # Fallback to cache if available
        if feed_cache["data"]:
            return feed_cache["data"], True
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, is_fallback = get_release_notes(force_refresh=force_refresh)
        return jsonify({
            'success': True,
            'releases': data,
            'is_fallback': is_fallback,
            'cached_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(feed_cache["timestamp"]))
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
