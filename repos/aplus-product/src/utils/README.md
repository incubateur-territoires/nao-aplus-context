# Route Permissions & Middleware

This directory contains utilities for managing route-based access control in the application.

## Files

- `auth.ts` - Utility functions for role checking
- `route-permissions.ts` - Route permission definitions and checking logic

## Usage

### Basic Role Checking

```typescript
import { isInstructor, hasRole, hasAnyRole } from "@/utils/auth";

// Check if user is an instructor
if (isInstructor(userRoles)) {
  // Handle instructor logic
}

// Check for specific role
if (hasRole(userRoles, Role.ADMIN)) {
  // Handle admin logic
}

// Check for any of multiple roles
if (hasAnyRole(userRoles, [Role.ADMIN, Role.OPERATOR])) {
  // Handle admin or instructor logic
}
```

### Route Permissions

The middleware automatically checks route permissions based on user roles. To add new restrictions:

1. Edit `route-permissions.ts` to add new route patterns
2. The middleware will automatically enforce these restrictions

Example configuration:

```typescript
export const ROUTE_PERMISSIONS = {
  // Routes that only users can access (not instructors)
  USER_ONLY: ["/signalement"],

  // Routes that only instructors can access
  INSTRUCTOR_ONLY: ["/admin", "/instructor-dashboard"],

  // Routes that require admin role
  ADMIN_ONLY: ["/admin", "/settings", "/user-management"],
} as const;
```

### Adding New Route Restrictions

1. **Simple role-based restrictions**: Add routes to the appropriate array in `ROUTE_PERMISSIONS`
2. **Complex restrictions**: Use the `MULTI_ROLE` object for routes requiring multiple roles
3. **Custom logic**: Extend the `canAccessRoute` function for more complex permission logic

### Testing

The middleware includes comprehensive tests in `src/middleware.test.ts`. Run tests with:

```bash
npm test middleware.test.ts
```

## How It Works

1. **Middleware**: Intercepts all requests and checks permissions
2. **Session**: Uses Better Auth to get user session and roles
3. **Permissions**: Checks user roles against route requirements
4. **Redirects**: Redirects unauthorized users with error messages
5. **UI**: Shows access denied alerts to users

## Error Handling

- Unauthenticated users are redirected to `/connexion`
- Unauthorized users are redirected to `/` with error parameters
- The `AccessDeniedAlert` component displays error messages to users
- All errors are logged for debugging
