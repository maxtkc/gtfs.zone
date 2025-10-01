# Browse - Route Page

**Status**: 🔴 Not Started
**Priority**: High
**Estimated Effort**: Large (2-3 weeks)

## Overview
Enhance route page with service exception management, service sharing information, and duplication capabilities to better handle complex GTFS service patterns.

## Checklist

### Service Exception Management
- [ ] Implement auto-refresh after adding service exception
- [ ] Query and display all routes using the same service
- [ ] Add warning UI for modifications to shared services
- [ ] Show which routes will be affected by service changes

### Service Duplication
- [ ] Create "Duplicate Service" button
- [ ] Implement service duplication workflow:
  - [ ] Copy calendar/calendar_dates records
  - [ ] Copy trips for current route
  - [ ] Option to copy trips from other routes using the service
- [ ] Generate unique service_id for duplicated services
- [ ] Update all foreign key references (trips → new service_id)

### New Service Creation
- [ ] Create "Add New Service" button
- [ ] Design service creation wizard:
  - [ ] Service ID input
  - [ ] Days of week selector (calendar.txt)
  - [ ] Date range picker (start_date, end_date)
  - [ ] Exception dates (calendar_dates.txt)
- [ ] Validate service doesn't overlap with existing services
- [ ] Create initial trips for the new service

### Special Service Exception Adders
- [ ] Holiday template (common holidays: Thanksgiving, Christmas, etc.)
- [ ] Every-other-day template (Monday/Wednesday/Friday or Tuesday/Thursday)
- [ ] Weekend-only template
- [ ] Weekday-only template
- [ ] Custom recurring pattern builder

### Testing & Polish
- [ ] Handle multi-agency scenarios (services shared across agencies)
- [ ] Test service modification workflows with dependent routes
- [ ] Test performance with services used by 50+ routes
- [ ] Add undo/redo for service modifications
- [ ] Document GTFS service best practices

## Current Architecture

### Route Page Rendering
The route page is currently rendered through `PageContentRenderer` (dependency injection in `ObjectsNavigation`).

From `objects-navigation.ts:86-146`:
```typescript
constructor(
  gtfsRelationships: {...},
  mapController: {...},
  scheduleController?: {
    renderSchedule: (
      route_id: string,
      service_id: string,
      direction_id?: string
    ) => Promise<string>;
  },
  serviceDaysController?: {
    renderServiceEditor: (service_id: string) => Promise<string>;
  }
) {
  this.scheduleController = scheduleController;
  this.serviceDaysController = serviceDaysController;
}
```

**Current Dependencies:**
- `scheduleController` - For timetable rendering
- `serviceDaysController` - For service day editing

### Service Relationships in GTFS

**Core Relationship:**
```
routes.txt
  ↓ (route_id)
trips.txt (service_id)
  ↓
calendar.txt OR calendar_dates.txt
```

**Multiple Routes Can Share Services:**
```
Route A (bus_101) → service_weekday
Route B (bus_102) → service_weekday  ← SAME SERVICE
Route C (bus_103) → service_weekend

Modifying service_weekday affects BOTH Route A and Route B!
```

**Cross-Agency Services (Less Common but Valid):**
```
Agency A → Route X → service_regional
Agency B → Route Y → service_regional  ← SAME SERVICE

This is valid GTFS but uncommon in practice.
```

## Feature 1: Auto-Refresh After Service Exception

### Current Issue
When user adds a service exception (e.g., "no service on December 25"), the timetable view doesn't refresh to show the change.

### Implementation

```typescript
// In ScheduleController or ServiceDaysController
async addServiceException(
  service_id: string,
  date: string,
  exception_type: '1' | '2'  // 1=Added, 2=Removed
): Promise<void> {
  const database = this.gtfsParser.gtfsDatabase;

  // Add exception to calendar_dates.txt
  await database.insertRow('calendar_dates', {
    service_id: service_id,
    date: date,
    exception_type: exception_type,
  });

  console.log(`Added service exception: ${service_id} on ${date} (type ${exception_type})`);

  // NEW: Auto-refresh current timetable if viewing this service
  if (
    this.currentRouteId &&
    this.currentServiceId === service_id
  ) {
    await this.refreshCurrentTimetable();
    notifications.showSuccess('Service exception added and timetable refreshed');
  } else {
    notifications.showSuccess('Service exception added');
  }
}
```

## Feature 2: Show Routes Using Same Service

### UI Design

When viewing a route with a shared service, display warning:

```
┌──────────────────────────────────────────────┐
│ Route 101 - Downtown Express                │
│ Service: weekday_service                     │
├──────────────────────────────────────────────┤
│ ⚠️  Service Warning                         │
│                                              │
│ This service is also used by:               │
│  • Route 102 - Uptown Local                 │
│  • Route 103 - Crosstown Shuttle            │
│                                              │
│ Changes to this service will affect all     │
│ routes listed above.                         │
│                                              │
│ [Duplicate Service] [Edit Service]          │
└──────────────────────────────────────────────┘
```

### Implementation

```typescript
// Add to PageContentRenderer or create RouteViewController
class RouteViewController {
  async getRoutesUsingService(service_id: string): Promise<Route[]> {
    // Query all trips with this service_id
    const trips = await this.database.queryRows('trips', { service_id });

    // Get unique route_ids
    const routeIds = [...new Set(trips.map(t => t.route_id))];

    // Fetch route details
    const routes = await Promise.all(
      routeIds.map(id => this.database.queryRows('routes', { route_id: id }))
    );

    return routes.flat();
  }

  renderServiceWarning(
    currentRoute: Route,
    sharedRoutes: Route[]
  ): string {
    if (sharedRoutes.length <= 1) {
      return ''; // Only one route uses this service
    }

    const otherRoutes = sharedRoutes.filter(
      r => r.route_id !== currentRoute.route_id
    );

    return `
      <div class="alert alert-warning shadow-lg mb-4">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 class="font-bold">Shared Service</h3>
            <div class="text-sm">
              This service is also used by ${otherRoutes.length} other route(s):
              <ul class="mt-2 list-disc list-inside">
                ${otherRoutes.map(route => `
                  <li>
                    <a href="#" class="link" onclick="navigateToRoute('${route.route_id}')">
                      ${route.route_short_name || route.route_long_name || route.route_id}
                    </a>
                  </li>
                `).join('')}
              </ul>
              Changes to this service will affect all listed routes.
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
```

## Feature 3: Duplicate Service Button

### Workflow

```
User clicks [Duplicate Service]
  ↓
Modal appears:
  ┌─────────────────────────────────────┐
  │ Duplicate Service                   │
  ├─────────────────────────────────────┤
  │ Original Service: weekday_service   │
  │ New Service ID: [weekday_service_2] │
  │                                     │
  │ ☑ Copy trips from current route     │
  │ ☐ Copy trips from other routes:    │
  │   ☐ Route 102 - Uptown Local       │
  │   ☐ Route 103 - Crosstown Shuttle  │
  │                                     │
  │ [Cancel] [Duplicate]                │
  └─────────────────────────────────────┘
  ↓
Service duplicated:
  - calendar.txt record copied
  - calendar_dates.txt exceptions copied
  - Selected trips copied with new service_id
  ↓
User can now modify new service independently
```

### Implementation

```typescript
class ServiceController {
  async duplicateService(
    originalServiceId: string,
    newServiceId: string,
    options: {
      copyCurrentRouteTrips: boolean;
      copyOtherRouteIds?: string[];
    }
  ): Promise<void> {
    const database = this.gtfsParser.gtfsDatabase;

    // 1. Copy calendar record if exists
    const calendarRecords = await database.queryRows('calendar', {
      service_id: originalServiceId,
    });

    if (calendarRecords.length > 0) {
      const newCalendar = {
        ...calendarRecords[0],
        service_id: newServiceId,
      };
      await database.insertRow('calendar', newCalendar);
      console.log('Copied calendar record');
    }

    // 2. Copy calendar_dates exceptions
    const exceptionRecords = await database.queryRows('calendar_dates', {
      service_id: originalServiceId,
    });

    for (const exception of exceptionRecords) {
      const newException = {
        ...exception,
        service_id: newServiceId,
      };
      await database.insertRow('calendar_dates', newException);
    }
    console.log(`Copied ${exceptionRecords.length} service exceptions`);

    // 3. Copy trips
    const routeIdsToCopy = [
      ...(options.copyCurrentRouteTrips ? [this.currentRouteId] : []),
      ...(options.copyOtherRouteIds || []),
    ];

    let copiedTripCount = 0;
    for (const route_id of routeIdsToCopy) {
      const trips = await database.queryRows('trips', {
        route_id,
        service_id: originalServiceId,
      });

      for (const trip of trips) {
        const newTripId = `${trip.trip_id}_copy_${Date.now()}`;
        const newTrip = {
          ...trip,
          trip_id: newTripId,
          service_id: newServiceId,
        };

        await database.insertRow('trips', newTrip);

        // Copy stop_times for this trip
        const stopTimes = await database.queryRows('stop_times', {
          trip_id: trip.trip_id,
        });

        for (const stopTime of stopTimes) {
          const newStopTime = {
            ...stopTime,
            trip_id: newTripId,
          };
          await database.insertRow('stop_times', newStopTime);
        }

        copiedTripCount++;
      }
    }

    console.log(`Duplicated service: ${originalServiceId} → ${newServiceId}`);
    console.log(`Copied ${copiedTripCount} trips with their stop_times`);

    notifications.showSuccess(
      `Service duplicated successfully (${copiedTripCount} trips copied)`
    );

    // Refresh route page to show new service
    await this.refreshRoutePage();
  }
}
```

## Feature 4: Add New Service Button

### Workflow

```
User clicks [Add New Service]
  ↓
Wizard Step 1: Basic Info
  ┌─────────────────────────────────────┐
  │ Create New Service                  │
  ├─────────────────────────────────────┤
  │ Service ID: [new_service_123]       │
  │                                     │
  │ [Cancel] [Next]                     │
  └─────────────────────────────────────┘
  ↓
Wizard Step 2: Service Days
  ┌─────────────────────────────────────┐
  │ Select Service Days                 │
  ├─────────────────────────────────────┤
  │ ☑ Monday    ☑ Thursday              │
  │ ☑ Tuesday   ☑ Friday                │
  │ ☑ Wednesday ☐ Saturday              │
  │ ☐ Sunday                            │
  │                                     │
  │ Start Date: [2024-01-01]            │
  │ End Date:   [2024-12-31]            │
  │                                     │
  │ [Back] [Next]                       │
  └─────────────────────────────────────┘
  ↓
Wizard Step 3: Exceptions (Optional)
  ┌─────────────────────────────────────┐
  │ Add Exception Dates                 │
  ├─────────────────────────────────────┤
  │ [Use Holiday Template ▼]            │
  │                                     │
  │ Or add custom dates:                │
  │ Date: [2024-12-25]                  │
  │ Type: ● No Service  ○ Add Service   │
  │ [+ Add Exception]                   │
  │                                     │
  │ [Back] [Finish]                     │
  └─────────────────────────────────────┘
```

### Implementation

```typescript
class NewServiceWizard {
  private serviceData = {
    service_id: '',
    monday: '0',
    tuesday: '0',
    wednesday: '0',
    thursday: '0',
    friday: '0',
    saturday: '0',
    sunday: '0',
    start_date: '',
    end_date: '',
    exceptions: [] as Array<{ date: string; type: '1' | '2' }>,
  };

  async createNewService(): Promise<void> {
    const database = this.gtfsParser.gtfsDatabase;

    // 1. Create calendar record
    await database.insertRow('calendar', {
      service_id: this.serviceData.service_id,
      monday: this.serviceData.monday,
      tuesday: this.serviceData.tuesday,
      wednesday: this.serviceData.wednesday,
      thursday: this.serviceData.thursday,
      friday: this.serviceData.friday,
      saturday: this.serviceData.saturday,
      sunday: this.serviceData.sunday,
      start_date: this.serviceData.start_date,
      end_date: this.serviceData.end_date,
    });

    // 2. Create calendar_dates exceptions
    for (const exception of this.serviceData.exceptions) {
      await database.insertRow('calendar_dates', {
        service_id: this.serviceData.service_id,
        date: exception.date,
        exception_type: exception.type,
      });
    }

    notifications.showSuccess('New service created successfully');
  }
}
```

## Feature 5: Special Service Exception Templates

### Holiday Template

```typescript
const US_HOLIDAYS_2024 = {
  "New Year's Day": '20240101',
  "Martin Luther King Jr. Day": '20240115',
  "Presidents Day": '20240219',
  "Memorial Day": '20240527',
  "Independence Day": '20240704',
  "Labor Day": '20240902',
  "Thanksgiving": '20241128',
  "Christmas": '20241225',
};

async function addHolidayExceptions(
  service_id: string,
  holidays: string[]
): Promise<void> {
  for (const holidayName of holidays) {
    const date = US_HOLIDAYS_2024[holidayName];
    if (date) {
      await database.insertRow('calendar_dates', {
        service_id,
        date,
        exception_type: '2', // No service
      });
    }
  }
}
```

### Every-Other-Day Template

```typescript
function generateEveryOtherDayDates(
  startDate: string,
  endDate: string,
  startOnOdd: boolean
): string[] {
  const dates: string[] = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfMonth = current.getDate();
    if ((startOnOdd && dayOfMonth % 2 === 1) || (!startOnOdd && dayOfMonth % 2 === 0)) {
      dates.push(current.toISOString().split('T')[0].replace(/-/g, ''));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
```

## Multi-Agency Service Handling

### Scenario
```
Agency A: Metro Transit
  Route 1 → service_weekday

Agency B: Regional Bus
  Route 10 → service_weekday  ← SAME SERVICE ID

This is valid GTFS but creates complexity:
- Which agency "owns" the service?
- How to display in UI?
- What happens if Agency A modifies the service?
```

### Solution: Display Agency Context

```html
<div class="service-info">
  <h4>Service: weekday_service</h4>
  <p>Used by routes from multiple agencies:</p>
  <ul>
    <li>Agency A: Route 1, Route 2</li>
    <li>Agency B: Route 10</li>
  </ul>
  <div class="alert alert-info">
    This service spans multiple agencies. Coordinate changes carefully.
  </div>
</div>
```

## GTFS Specification Context

### calendar.txt
```
service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
weekday,1,1,1,1,1,0,0,20240101,20241231
weekend,0,0,0,0,0,1,1,20240101,20241231
```

- Days: 1=service operates, 0=no service
- Dates: YYYYMMDD format

### calendar_dates.txt (Exceptions)
```
service_id,date,exception_type
weekday,20241225,2  ← Christmas: no service
weekend,20240704,1  ← July 4th: add special service
```

- exception_type: 1=service added, 2=service removed

## Testing

### Service Exception Tests
- [ ] Add exception, verify timetable refreshes
- [ ] Remove exception, verify timetable updates
- [ ] Add exception to shared service, verify warning appears

### Service Duplication Tests
- [ ] Duplicate service with calendar
- [ ] Duplicate service with calendar_dates
- [ ] Duplicate with trip copying (current route only)
- [ ] Duplicate with trip copying (multiple routes)
- [ ] Verify unique service_id generation

### New Service Tests
- [ ] Create weekday-only service
- [ ] Create weekend-only service
- [ ] Create service with holidays excluded
- [ ] Create service with custom exceptions

## Resources

- GTFS calendar.txt: https://gtfs.org/schedule/reference/#calendartxt
- GTFS calendar_dates.txt: https://gtfs.org/schedule/reference/#calendar_datestxt
- Current implementation: `schedule-controller.ts`, `objects-navigation.ts`

## Next Steps

1. Create `ServiceController` class for service operations
2. Implement `getRoutesUsingService()` query
3. Add service warning UI to route page
4. Implement service duplication with modal UI
5. Create new service wizard (multi-step form)
6. Add holiday template and date generators
7. Test with multi-route and multi-agency scenarios