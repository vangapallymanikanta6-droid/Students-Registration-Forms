CREATE DATABASE IF NOT EXISTS businesslabs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE businesslabs;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  dob DATE NULL,
  gender VARCHAR(50) NULL,
  qualification VARCHAR(100) NULL,
  className VARCHAR(100) NULL,
  subject VARCHAR(255) NULL,
  marks DECIMAL(5,2) NULL,
  interests JSON NULL,
  role ENUM('admin', 'student') NOT NULL DEFAULT 'student',
  aadhaarFileName VARCHAR(255) NULL,
  aadhaarOriginalName VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO users (name, email, password, role)
VALUES ('Administrator', 'admin@businesslabs.com', 'admin123', 'admin');
