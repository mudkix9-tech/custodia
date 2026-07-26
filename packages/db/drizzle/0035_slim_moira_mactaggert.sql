CREATE TABLE "rate_limits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 1,
	"expires_at" timestamp with time zone NOT NULL
);
