CREATE DATABASE IF NOT EXISTS graduation_clearance_db;
USE graduation_clearance_db;

-- 1. Faculties Table
CREATE TABLE faculties (
    faculty_id INT PRIMARY KEY AUTO_INCREMENT,
    faculty_name VARCHAR(100) UNIQUE NOT NULL
);

-- Insert sample faculties (you can customize these later)
INSERT INTO faculties (faculty_name) VALUES 
('Faculty of Computing and Informatics'),
('Faculty of Engineering'),
('Faculty of Business and Management'),
('Faculty of Science');

-- 2. Roles Table
CREATE TABLE roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (role_name) VALUES 
('Student'), 
('Guild'), 
('Librarian'), 
('Finance'), 
('HOD'), 
('Dean'), 
('AR'),
('FacultyHead');

-- 3. Users Table (Handles logins for all roles)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);

-- 4. Students Table (Now linked to a Faculty)
CREATE TABLE students (
    reg_no VARCHAR(20) PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    user_id INT UNIQUE NOT NULL,
    faculty_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id) ON DELETE CASCADE
);

-- 5. Clearance Requests Table (Updated workflow starting at 'Guild')
CREATE TABLE clearance_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    reg_no VARCHAR(20) UNIQUE NOT NULL,
    current_stage ENUM('Guild', 'Library', 'Finance', 'HOD', 'Dean', 'AR', 'Completed') DEFAULT 'Guild',
    status ENUM('Pending', 'Rejected', 'Completed') DEFAULT 'Pending',
    last_rejected_by VARCHAR(30) DEFAULT NULL,
    resubmitted BOOLEAN DEFAULT FALSE,
    request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_no) REFERENCES students(reg_no) ON DELETE CASCADE
);

-- 6. Approvals History Table (Tracks all department decisions & oversight data)
CREATE TABLE approvals (
    approval_id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    department VARCHAR(30) NOT NULL,
    decision ENUM('Approved', 'Rejected') NOT NULL,
    comments TEXT DEFAULT NULL,
    action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES clearance_requests(request_id) ON DELETE CASCADE
);

-- 7. Notifications Table
CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    reg_no VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_no) REFERENCES students(reg_no) ON DELETE CASCADE
);