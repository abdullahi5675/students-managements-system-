$env:PGPASSWORD="Abdullahi20@"

Write-Host "Creating the srms_db database..." -ForegroundColor Cyan
psql -U postgres -c "CREATE DATABASE srms_db;"

Write-Host "`nInitializing the database schema and tables..." -ForegroundColor Cyan
psql -U postgres -d srms_db -f init.sql

Write-Host "`nDatabase setup complete!" -ForegroundColor Green
Write-Host "You can now start the backend server." -ForegroundColor Yellow
