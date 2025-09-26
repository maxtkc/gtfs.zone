#!/bin/bash

# GTFS Snake Case Migration Script
# Converts all camelCase GTFS property access to snake_case

echo "🐍 Starting GTFS snake_case migration..."

# Common GTFS field mappings (camelCase -> snake_case)
declare -A field_mappings=(
    # Core GTFS fields
    ["arrivalTime"]="arrival_time"
    ["departureTime"]="departure_time"
    ["stopId"]="stop_id"
    ["stopName"]="stop_name"
    ["stopDesc"]="stop_desc"
    ["stopLat"]="stop_lat"
    ["stopLon"]="stop_lon"
    ["stopUrl"]="stop_url"
    ["stopCode"]="stop_code"
    ["stopTimezone"]="stop_timezone"
    ["wheelchairBoarding"]="wheelchair_boarding"
    ["levelId"]="level_id"
    ["platformCode"]="platform_code"
    ["parentStation"]="parent_station"
    ["zoneId"]="zone_id"
    ["locationId"]="location_id"
    ["locationType"]="location_type"

    ["routeId"]="route_id"
    ["routeShortName"]="route_short_name"
    ["routeLongName"]="route_long_name"
    ["routeDesc"]="route_desc"
    ["routeType"]="route_type"
    ["routeUrl"]="route_url"
    ["routeColor"]="route_color"
    ["routeTextColor"]="route_text_color"
    ["routeSortOrder"]="route_sort_order"
    ["continuousPickup"]="continuous_pickup"
    ["continuousDropOff"]="continuous_drop_off"
    ["networkId"]="network_id"

    ["tripId"]="trip_id"
    ["tripHeadsign"]="trip_headsign"
    ["tripShortName"]="trip_short_name"
    ["directionId"]="direction_id"
    ["blockId"]="block_id"
    ["shapeId"]="shape_id"
    ["wheelchairAccessible"]="wheelchair_accessible"
    ["bikesAllowed"]="bikes_allowed"

    ["serviceId"]="service_id"
    ["startDate"]="start_date"
    ["endDate"]="end_date"

    ["stopSequence"]="stop_sequence"
    ["stopHeadsign"]="stop_headsign"
    ["pickupType"]="pickup_type"
    ["dropOffType"]="drop_off_type"
    ["shapeDistTraveled"]="shape_dist_traveled"
    ["timepoint"]="timepoint"

    ["shapePtLat"]="shape_pt_lat"
    ["shapePtLon"]="shape_pt_lon"
    ["shapePtSequence"]="shape_pt_sequence"

    ["agencyId"]="agency_id"
    ["agencyName"]="agency_name"
    ["agencyUrl"]="agency_url"
    ["agencyTimezone"]="agency_timezone"
    ["agencyLang"]="agency_lang"
    ["agencyPhone"]="agency_phone"
    ["agencyFareUrl"]="agency_fare_url"
    ["agencyEmail"]="agency_email"

    ["feedPublisherName"]="feed_publisher_name"
    ["feedPublisherUrl"]="feed_publisher_url"
    ["feedLang"]="feed_lang"
    ["feedStartDate"]="feed_start_date"
    ["feedEndDate"]="feed_end_date"
    ["feedVersion"]="feed_version"
    ["feedContactEmail"]="feed_contact_email"
    ["feedContactUrl"]="feed_contact_url"
    ["defaultLang"]="default_lang"

    ["fareId"]="fare_id"
    ["price"]="price"
    ["currencyType"]="currency_type"
    ["paymentMethod"]="payment_method"
    ["transfers"]="transfers"
    ["transferDuration"]="transfer_duration"

    ["fromStopId"]="from_stop_id"
    ["toStopId"]="to_stop_id"
    ["transferType"]="transfer_type"
    ["minTransferTime"]="min_transfer_time"

    ["headwaySecs"]="headway_secs"
    ["startTime"]="start_time"
    ["endTime"]="end_time"
    ["exactTimes"]="exact_times"
)

# File patterns to search
file_patterns=(
    "src/**/*.ts"
    "src/**/*.js"
    "tests/**/*.ts"
    "tests/**/*.js"
)

# Function to perform replacements
perform_replacements() {
    local dry_run="$1"
    local flag=""

    if [ "$dry_run" = "true" ]; then
        echo "🔍 DRY RUN - showing what would be changed:"
        flag="--dry-run"
    else
        echo "✏️  Performing actual replacements..."
    fi

    for pattern in "${file_patterns[@]}"; do
        for camel_case in "${!field_mappings[@]}"; do
            snake_case="${field_mappings[$camel_case]}"

            # Replace property access: obj.camelCase -> obj.snake_case
            find . -name "$pattern" -type f -exec sed -i$flag "s/\\.${camel_case}\\b/.${snake_case}/g" {} \; 2>/dev/null || true

            # Replace object destructuring: { camelCase } -> { snake_case }
            find . -name "$pattern" -type f -exec sed -i$flag "s/{ *${camel_case} *}/{ ${snake_case} }/g" {} \; 2>/dev/null || true
            find . -name "$pattern" -type f -exec sed -i$flag "s/, *${camel_case} *}/, ${snake_case} }/g" {} \; 2>/dev/null || true
            find . -name "$pattern" -type f -exec sed -i$flag "s/{ *${camel_case} *,/{ ${snake_case},/g" {} \; 2>/dev/null || true

            # Replace in object literals: camelCase: -> snake_case:
            find . -name "$pattern" -type f -exec sed -i$flag "s/${camel_case}:/${snake_case}:/g" {} \; 2>/dev/null || true

            # Replace in bracket notation: obj['camelCase'] -> obj['snake_case']
            find . -name "$pattern" -type f -exec sed -i$flag "s/\\['${camel_case}'\\]/['${snake_case}']/g" {} \; 2>/dev/null || true
            find . -name "$pattern" -type f -exec sed -i$flag "s/\\[\"${camel_case}\"\\]/[\"${snake_case}\"]/g" {} \; 2>/dev/null || true
        done
    done
}

# Show what would be changed
echo "📋 Preview of changes that will be made:"
perform_replacements true | head -20

echo ""
read -p "🤔 Do you want to proceed with the migration? (y/N): " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    echo "🚀 Starting migration..."
    perform_replacements false

    echo "✅ Basic property replacements complete!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Update type generation script (remove camelCase conversion)"
    echo "2. Regenerate TypeScript types"
    echo "3. Run TypeScript compiler to find remaining issues"
    echo "4. Run tests to verify everything works"
    echo ""
    echo "Run: npm run typecheck"
else
    echo "❌ Migration cancelled"
fi