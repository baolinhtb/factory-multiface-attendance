#!/bin/bash
# Backup database script
# Run this periodically or before major updates

BACKUP_DIR="backups"
DB_FILE="backend/attendance.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/attendance_${TIMESTAMP}.db"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Copy database
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_FILE"
    echo "✓ Backup created: $BACKUP_FILE"
    
    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/attendance_*.db 2>/dev/null | tail -n +11 | xargs -r rm
    echo "✓ Old backups cleaned (keeping last 10)"
else
    echo "❌ Database file not found: $DB_FILE"
    exit 1
fi

echo ""
echo "Current backups:"
ls -lh "$BACKUP_DIR"/attendance_*.db 2>/dev/null
