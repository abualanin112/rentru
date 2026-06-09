# Notes Feature Notes

## Tech Debt

- **Pagination Strategy**: The current cursor pagination is excellent for infinite scrolling UI patterns but makes traditional offset pagination (page 1, 2, 3...) impossible. If the UI requires direct page navigation, a fallback offset-pagination strategy might be needed (though not recommended for massive datasets).

## Assumptions

- **Full-Text Search Language**: The PostgreSQL full-text search assumes the default language configuration of the database. If multi-lingual search is required, the Prisma schema or query implementation will need adjustment to support language-specific dictionaries.
- **Data Boundaries**: We strictly enforce `onDelete: Restrict` in the Prisma schema for the User relationship. We assume that application-layer hook execution is guaranteed (even under server crash scenarios, thanks to Prisma transactions) to prevent data corruption.
