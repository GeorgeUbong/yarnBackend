# Running the backend tests

These are integration tests: they send HTTP requests through the Express app and use Prisma to read and write a PostgreSQL database. Use a **dedicated test database**. Do not point `TEST_DATABASE_URL` at production or at a database containing data you need.

## 1. Start PostgreSQL and create a test database

Start your local PostgreSQL server, then create an empty database named `snapy_test` using pgAdmin or your preferred PostgreSQL tool. The PostgreSQL user in the connection URL needs permission to create and modify tables.

For a local server with the default port, the URL usually looks like this:

```text
postgresql://postgres:YOUR_PASSWORD@localhost:5432/snapy_test?schema=public
```

Replace `YOUR_PASSWORD` with your local PostgreSQL password. If your username or password contains URL-reserved characters (for example `@`, `:`, `/`, or `#`), URL-encode those characters in the connection URL.

## 2. Open PowerShell in the project folder

```powershell
cd "C:\Users\DELL\Documents\backend\yarnBackend"
```

Install the project's dependencies if you have not already:

```powershell
npm install
```

Set the test database URL in this PowerShell window. Replace the sample URL with the connection details for the database you created:

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/snapy_test?schema=public"
```

The test runner requires this variable and will stop with an error if it is missing. It also refuses to run if `TEST_DATABASE_URL` is exactly the same as `DATABASE_URL`.

## 3. Apply the Prisma migrations to the test database

In the same PowerShell window, temporarily set `DATABASE_URL` to the test database URL. Prisma CLI reads `DATABASE_URL` from the project config:

```powershell
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npx prisma migrate deploy --config prisma7.config.ts
if ($LASTEXITCODE -ne 0) { throw "Migration failed. Check the database URL and PostgreSQL connection." }
```

This applies the project's existing migrations to `snapy_test`; it does not reset or delete the database. Leave `$env:DATABASE_URL` set to the test URL in this window while working with the test database.

## 4. Run the tests

Run all test suites:

```powershell
npm test
```

Or run a single suite:

```powershell
npm run test:auth
npm run test:user
npm run test:db
```

The suites cover:

- **Auth:** invalid signup input, registration, duplicate email, and login success/failure.
- **User/API:** authentication protection and creating, listing, updating, and deleting a user's post.
- **Database:** writing and reading users/posts, loading the relation, and verifying cascade deletion.

Test records use generated email addresses and are removed after the tests. The database test checks that deleting a user cascades to its posts.

## 5. Confirm the results

Vitest prints a summary with the number of passing test files and tests. A successful full run should show all three test files passing. If you see `TEST_DATABASE_URL must point to a dedicated test database`, return to step 2 and set that variable in the same PowerShell window before running the tests.

## Troubleshooting

- **Connection refused / cannot connect:** confirm PostgreSQL is running, the port is correct, and the URL credentials are valid.
- **Database does not exist:** create `snapy_test` before running migrations.
- **Authentication failed:** check the PostgreSQL username and password. URL-encode reserved characters in credentials.
- **Missing table or relation:** run the migration command from step 3 using the test URL.
- **Environment variable disappeared:** PowerShell environment variables are scoped to that terminal window. Set `TEST_DATABASE_URL` again in any new window.
- **Tests pass individually but not together:** run `npm test`; test execution is configured to run files serially to reduce shared-database interference.

When finished, close the PowerShell window to clear the environment variables set for that session.
