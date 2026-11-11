CREATE DATABASE IF NOT EXISTS graduation_clearance_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE graduation_clearance_db;

CREATE TABLE IF NOT EXISTS faculties (
    faculty_id INT PRIMARY KEY AUTO_INCREMENT,
    faculty_name VARCHAR(100) UNIQUE NOT NULL
);

INSERT IGNORE INTO faculties (faculty_name) VALUES
    ('Faculty of Computing and Informatics'),
    ('Faculty of Engineering'),
    ('Faculty of Business and Management'),
    ('Faculty of Science');

CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

INSERT IGNORE INTO roles (role_name) VALUES
    ('Student'),
    ('Guild'),
    ('Librarian'),
    ('Finance'),
    ('HOD'),
    ('Dean'),
    ('AR'),
    ('FacultyHead');

CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
    reg_no VARCHAR(20) PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    user_id INT UNIQUE NOT NULL,
    faculty_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clearance_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    reg_no VARCHAR(20) UNIQUE NOT NULL,
    current_stage ENUM('Guild', 'Library', 'Finance', 'HOD', 'Dean', 'AR', 'Completed') NOT NULL DEFAULT 'Guild',
    status ENUM('Pending', 'Rejected', 'Completed') NOT NULL DEFAULT 'Pending',
    last_rejected_by VARCHAR(30) DEFAULT NULL,
    resubmitted BOOLEAN NOT NULL DEFAULT FALSE,
    request_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_no) REFERENCES students(reg_no) ON DELETE CASCADE,
    INDEX idx_clearance_queue (current_stage, status, request_date)
);

CREATE TABLE IF NOT EXISTS approvals (
    approval_id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    department VARCHAR(30) NOT NULL,
    decision ENUM('Approved', 'Rejected') NOT NULL,
    comments TEXT DEFAULT NULL,
    action_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES clearance_requests(request_id) ON DELETE CASCADE,
    INDEX idx_approvals_request (request_id, action_date)
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    reg_no VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_no) REFERENCES students(reg_no) ON DELETE CASCADE,
    INDEX idx_notifications_student (reg_no, created_at)
);
