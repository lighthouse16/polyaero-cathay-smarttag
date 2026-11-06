# Cathay Shell UI Reconstruction

This directory is reserved for pixel-perfect reconstruction of the official Cathay Pacific mobile app shell:
- Home screen & flight card components
- Tab bar navigation (Home, Book, Trips, Account)
- Profile & Marco Polo / Cathay membership tier indicators
- Trip itinerary details view

## Rules of Engagement:
1. **NO SPECULATIVE UI**: Do not write Cathay UI screens until actual screenshots are provided and logged in `docs/screen-inventory.md`.
2. **CLEAN ISOLATION**: All reconstructed Cathay UI code belongs inside this directory (`cathay-shell`).
3. **MOCK DATA ONLY**: Reconstructed screens must connect exclusively to local typed mock data from `@polyaero/shared`. Never attempt to access private Cathay production APIs.
4. **INTEGRATION POINT**: The SmartTag feature will plug into the Trips screen as an expandable "Digital Baggage ID" card.
