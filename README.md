# Jotform Frontend Challenge Project

## User Information
- **Name**: Berkay Şimşek

## Project Description
This app is a live investigation dashboard for the “Missing Podo: The Ankara Case” story. When you open it, it pulls records from five different sources: check-ins, messages, sightings, personal notes, and anonymous tips. Its job is to combine those into one timeline so you can follow Podo’s last known movements and quickly see which people keep appearing around that trail.

## Getting Started
1. Clone the repository
- git clone https://github.com/BerkayySimsekk/Berkay-Simsek
- cd jotform-project

2. Install dependencies
- npm install

3. Start the development server
- npm run dev

4. Open in browser
- The app will be available at: http://localhost:5173/ (or the URL shown in the terminal)

## The Organization of the App
1. The top summary tells you the latest confirmed place in Podo’s trail, which person the app currently considers the highest-interest lead, and how many data sources were loaded successfully.

2. On the left, you can search and filter by person, location, and content type. Under that, you get a list of linked people. In the center, you see the main timeline of events in chronological order. On the right, you get a detail view for whatever you select.

3. If you click a person, the app shows that person’s aliases, why they matter, where they appear, which sources mention them, and all connected records. If you click a record, it shows the full content, the people involved, the metadata, and other related records around it.

## Implemented Bonus Features
1. Podo route flow feature that can accessed through the "Podo Route Flow" button on the top right which allows you to follow Podo's movement stop by stop, inspect the evidence supporting each location, and keep weaker or conflicting clues visible instead of flattening them into one story.

2. Map view feature that can be accessed through the "Investigation Map" button on the top right which shows the case data geographically instead of as a timeline, it takes every loaded record that has valid coordinates, places it on an interactive map, and groups nearby records into a single pin so the view does not get cluttered.

3. Summary panels for "Last seen with" and "Most suspicious" can be seen on the top right of the investigation dashboard which include short reasonings.

4. Smarter person matching feature is implemented through a fuzzy identity resolver that can merge variants like abbreviations, initials, and minor misspellings using name similarity plus context such as shared locations, nearby times, and repeated co-occurrence. 

