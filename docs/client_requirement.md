Scenario
A company operates a central HQ system managing multiple F&B outlets. HQ manages the master menu, assigns menu items to outlets, and monitors sales activity across outlets. Each outlet can process sales transactions and deduct inventory locally.

Single Company → Multiple Outlets → HQ assigns menu → Outlets create sales → HQ sees reports.
Time Expectation
This assessment should take you 3-5 days to complete
Estimated effort: 18 - 28 hours
Required Implementation
Master Menu + Outlet Assignment

HQ should be able to:
Create master menu items
Assign menu items to specific outlets
Override menu price per outlet

Each outlet should be able to:
Retrieve only the menu items assigned to that outlet.

Inventory Management
Each outlet maintains its own inventory per menu item.

Requirements:
Stock is tracked per outlet
Sales deduct stock from outlet inventory
System must prevent negative stock

Sales Transaction
Create a sale with multiple items
Deduct stock per outlet
Prevent negative stock
Generate sequential receipt number per outlet
Receipt must remain correct under concurrent requests
Wrap in database transaction

Basic Reporting Endpoint
Total revenue by outlet
Top 5 selling items per outlet
Engineering Requirements
Tech Stack: PostgreSQL, Express.js, Node.js, React.js
Layered architecture
routes
controllers
services
repositories (or data access layer)
Input validation
Error middleware
Environment config
Database constraints (foreign keys, unique constraints where appropriate)
Proper indexing for frequently queried fields
Dockerfile
docker-compose
Deployed instance

Required Deliverables
Deployed Instance for End User to Access
GitHub Repository
Proper folder structure
Clean commits
README including:
Setup instructions
API endpoints
Schema explanation
Architecture explanation
Scaling strategy
Architecture Documentation
Provide a document including:
ERD Diagram for Database schema and relationships

Scaling Plan
How will the system design evolve for 10 Outlets, totaling 100,000 transactions per month?
Your answer should discuss:
database scaling strategies
reporting performance considerations
infrastructure considerations
architectural evolution
The implementation does not need to support this scale, but you should explain how the system could evolve to support it.
Conversion to Microservices
Explain how this system could evolve into microservices architecture.
Discuss which components could be separated and why.
Offline POS Mode Strategy
Explain how offline POS terminals could sync sales to HQ when internet reconnects.
Explain how you will ensure the POS and KDS can still function and communicate with each other during offline mode.
