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

## Organization of the App
1. At the top, the page navigation lets you switch between the main Investigation Dashboard, the Investigation Map, and the dedicated Podo Route Flow page. Inside the dashboard header, the summary panels now focus on “Last seen with” and “Most suspicious,” each with a short explanation of why that result was chosen.

2. On desktop, the dashboard is organized as a three-part workspace: search and filters plus linked people on the left, the main investigation timeline in the center, and the detail view on the right. On smaller screens, the layout switches to a compact responsive mode with Timeline, People, and Detail tabs, while filters open in a sheet and the detail view opens in a drawer.

3. The center timeline combines all five live data sources into one chronological investigation trail. It links related records by person and location, and it now uses virtualization so scrolling stays smoother as the number of records grows.

4. If you click a person, the app shows the resolved identity profile, including merged aliases, fuzzy-match reasoning, confidence, locations, source breakdown, and all connected records. If you click a record, it shows the full content, the people involved, the metadata, the original recorded name where relevant, and other related records around it.

## Implemented Bonus Features
1. Podo route flow feature that can accessed through the "Podo Route Flow" button on the top right which allows you to follow Podo's movement stop by stop, inspect the evidence supporting each location, and keep weaker or conflicting clues visible instead of flattening them into one story.

2. Map view feature that can be accessed through the "Investigation Map" button on the top right which shows the case data geographically instead of as a timeline, it takes every loaded record that has valid coordinates, places it on an interactive map, and groups nearby records into a single pin so the view does not get cluttered.

3. Summary panels for "Last seen with" and "Most suspicious" can be seen on the top right of the investigation dashboard which include short reasonings.

4. Smarter person matching feature is implemented through a fuzzy identity resolver that can merge variants like abbreviations, initials, and minor misspellings using name similarity plus context such as shared locations, nearby times, and repeated co-occurrence. 

