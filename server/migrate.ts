/**
 * Auto-migration: runs all pending migrations on app startup.
 * Uses raw mysql2 connection to avoid Drizzle ORM result-shape issues.
 */
import mysql from "mysql2/promise";

const migrations = [
  {
    name: "0000_initial",
    statements: [
      `CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`openId\` varchar(64),
        \`name\` text,
        \`email\` varchar(320),
        \`loginMethod\` varchar(64),
        \`passwordHash\` varchar(255),
        \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`users_openId_unique\` UNIQUE(\`openId\`)
      )`,
    ],
  },
  {
    name: "0001_scenarios_sessions",
    statements: [
      `CREATE TABLE IF NOT EXISTS \`scenarios\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`category\` varchar(100) NOT NULL,
        \`difficulty\` enum('beginner','intermediate','advanced') NOT NULL,
        \`description\` text NOT NULL,
        \`patientPersona\` text NOT NULL,
        \`learningObjectives\` json NOT NULL,
        \`tags\` json NOT NULL,
        \`estimatedMinutes\` int NOT NULL DEFAULT 10,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`scenarios_id\` PRIMARY KEY(\`id\`)
      )`,
      `CREATE TABLE IF NOT EXISTS \`sessions\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`scenarioId\` int NOT NULL,
        \`status\` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
        \`startedAt\` timestamp NOT NULL DEFAULT (now()),
        \`completedAt\` timestamp,
        \`durationSeconds\` int,
        CONSTRAINT \`sessions_id\` PRIMARY KEY(\`id\`)
      )`,
      `CREATE TABLE IF NOT EXISTS \`messages\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`sessionId\` int NOT NULL,
        \`role\` enum('user','assistant') NOT NULL,
        \`content\` text NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`messages_id\` PRIMARY KEY(\`id\`)
      )`,
      `CREATE TABLE IF NOT EXISTS \`scores\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`sessionId\` int NOT NULL,
        \`userId\` int NOT NULL,
        \`scenarioId\` int NOT NULL,
        \`activeListeningEmpathy\` float NOT NULL,
        \`informationGathering\` float NOT NULL,
        \`policyAdherence\` float NOT NULL,
        \`communicationClarity\` float NOT NULL,
        \`deEscalation\` float NOT NULL,
        \`overallScore\` float NOT NULL,
        \`overallGrade\` varchar(2) NOT NULL,
        \`wentWell\` text NOT NULL,
        \`areasForImprovement\` text NOT NULL,
        \`detailedFeedback\` json NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`scores_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`scores_sessionId_unique\` UNIQUE(\`sessionId\`)
      )`,
    ],
  },
  {
    name: "0003_force_sessions",
    statements: [
      `CREATE TABLE IF NOT EXISTS \`sessions\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`scenarioId\` int NOT NULL,
        \`status\` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
        \`startedAt\` timestamp NOT NULL DEFAULT (now()),
        \`completedAt\` timestamp,
        \`durationSeconds\` int,
        CONSTRAINT \`sessions_id\` PRIMARY KEY(\`id\`)
      )`,
      `CREATE TABLE IF NOT EXISTS \`messages\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`sessionId\` int NOT NULL,
        \`role\` enum('user','assistant') NOT NULL,
        \`content\` text NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`messages_id\` PRIMARY KEY(\`id\`)
      )`,
      `CREATE TABLE IF NOT EXISTS \`scores\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`sessionId\` int NOT NULL,
        \`userId\` int NOT NULL,
        \`scenarioId\` int NOT NULL,
        \`activeListeningEmpathy\` float NOT NULL,
        \`informationGathering\` float NOT NULL,
        \`policyAdherence\` float NOT NULL,
        \`communicationClarity\` float NOT NULL,
        \`deEscalation\` float NOT NULL,
        \`overallScore\` float NOT NULL,
        \`overallGrade\` varchar(2) NOT NULL,
        \`wentWell\` text NOT NULL,
        \`areasForImprovement\` text NOT NULL,
        \`detailedFeedback\` json NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`scores_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`scores_sessionId_unique\` UNIQUE(\`sessionId\`)
      )`,
    ],
  },
  {
    name: "0004_scenarios_mode_pharmacist",
    statements: [
      // Step 1: Add mode column if scenarios table exists but lacks it (safe no-op if already there)
      // First ensure scenarios table has mode column - use a try-safe approach
      // Step 1: Expand the enum to include all old + new values so UPDATE can succeed
      `ALTER TABLE \`scenarios\` MODIFY COLUMN \`mode\` enum('receptionist','clinician','gp','pharmacist') NOT NULL DEFAULT 'receptionist'`,
      // Step 2: Migrate 'clinician' rows to 'gp'
      `UPDATE \`scenarios\` SET \`mode\` = 'gp' WHERE \`mode\` = 'clinician'`,
      // Step 3: Narrow enum to final values only
      `ALTER TABLE \`scenarios\` MODIFY COLUMN \`mode\` enum('receptionist','gp','pharmacist') NOT NULL DEFAULT 'receptionist'`,
    ],
  },
  {
    name: "0005_scores_google_review",
    // This migration is handled specially in runMigrations() below
    // because it needs a JS-level column existence check
    statements: [],
  },
  {
    name: "0006_call_audits",
    statements: [
      `CREATE TABLE IF NOT EXISTS \`call_audits\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`clinicianName\` varchar(255),
        \`emisNumber\` varchar(64),
        \`auditDate\` varchar(32),
        \`audioUrl\` text,
        \`transcript\` mediumtext,
        \`consultationSuitability\` varchar(16),
        \`workingDiagnosis\` varchar(16),
        \`redFlagsLight\` varchar(16),
        \`treatmentFollowUp\` varchar(16),
        \`criteriaScores\` json,
        \`clinicalStrengths\` text,
        \`clinicalConcerns\` text,
        \`nonClinicalConcerns\` text,
        \`additionalNotes\` text,
        \`status\` varchar(32) NOT NULL DEFAULT 'pending',
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`call_audits_id\` PRIMARY KEY(\`id\`)
      )`,
    ],
  },
];

export async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[Migration] DATABASE_URL not set, skipping migrations");
    return;
  }

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(dbUrl);
    console.log("[Migration] Connected to database");

    // Create migrations tracking table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`_migrations\` (
        \`name\` varchar(255) NOT NULL,
        \`appliedAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`_migrations_name\` PRIMARY KEY(\`name\`)
      )
    `);

    // Get applied migrations — mysql2 returns [rows, fields]
    const [rows] = await conn.execute(`SELECT name FROM \`_migrations\``);
    const appliedNames = new Set(
      (rows as Array<{ name: string }>).map((r) => r.name)
    );
    console.log(`[Migration] Applied migrations: ${Array.from(appliedNames).join(", ") || "none"}`);

    // Run pending migrations
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        console.log(`[Migration] Skipping (already applied): ${migration.name}`);
        continue;
      }

      console.log(`[Migration] Running: ${migration.name}`);
      for (const statement of migration.statements) {
        await conn.execute(statement);
      }

      await conn.execute(
        `INSERT IGNORE INTO \`_migrations\` (\`name\`) VALUES (?)`,
        [migration.name]
      );
      // Special handling for 0005: check column existence via JS before ALTER
      if (migration.name === "0005_scores_google_review") {
        const [colRows] = await conn.execute(
          `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'scores'
             AND COLUMN_NAME = 'googleReviewOffer'`
        );
        const colExists = (colRows as Array<{ cnt: number }>)[0]?.cnt > 0;
        if (!colExists) {
          await conn.execute(
            `ALTER TABLE \`scores\` ADD COLUMN \`googleReviewOffer\` float NOT NULL DEFAULT 0`
          );
          console.log(`[Migration] Added googleReviewOffer column to scores`);
        } else {
          console.log(`[Migration] googleReviewOffer column already exists, skipping`);
        }
      }

      console.log(`[Migration] Completed: ${migration.name}`);
    }

    console.log("[Migration] All migrations up to date");
  } catch (error) {
    console.error("[Migration] Error running migrations:", error);
    // Don't throw — let the app start even if migrations fail
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}
