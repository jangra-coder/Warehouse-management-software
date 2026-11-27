-- Sample data so the software is not empty on the first run
-- (all names here are made up)

INSERT INTO products (sku, name, category, make, material, price, new_stock, used_stock, low_stock_limit, is_returnable, description) VALUES
('DB-006', 'Drill Bit 6mm',        'Drill Bits',   'Bosch',   'HSS',     120, 25, 4, 5, 1, 'For mild steel'),
('DB-010', 'Drill Bit 10mm',       'Drill Bits',   'Bosch',   'HSS',     180, 18, 2, 5, 1, NULL),
('DB-012', 'Drill Bit 12mm',       'Drill Bits',   'Addison', 'Cobalt',  320, 3,  1, 5, 1, NULL),
('EM-008', 'End Mill 8mm',         'End Mills',   'Kennametal', 'Carbide', 950, 10, 3, 4, 1, '4 flute'),
('EM-012', 'End Mill 12mm',        'End Mills',   'Kennametal', 'Carbide', 1400, 6, 2, 3, 1, '4 flute'),
('EM-016', 'End Mill 16mm',        'End Mills',   'Sandvik', 'Carbide', 2100, 2,  0, 3, 1, NULL),
('TP-M08', 'Tap M8',               'Taps',         'Totem',   'HSS',     260, 12, 0, 4, 1, NULL),
('TP-M10', 'Tap M10',              'Taps',         'Totem',   'HSS',     310, 9,  1, 4, 1, NULL),
('IN-CN12', 'Turning Insert CNMG12', 'Inserts',    'Taegutec', 'Carbide', 410, 40, 0, 10, 1, 'Box of 10 counted as 10'),
('VC-150', 'Vernier Caliper 150mm', 'Measuring',   'Mitutoyo', 'Steel',  2800, 5,  2, 2, 1, NULL),
('MM-025', 'Micrometer 0-25mm',    'Measuring',    'Mitutoyo', 'Steel',  3500, 3,  1, 2, 1, NULL),
('GW-04',  'Grinding Wheel 4 inch', 'Consumables', 'Norton',  'Abrasive', 90, 30, 0, 10, 0, 'Used up, not returned'),
('CO-01',  'Coolant Oil 1L',       'Consumables',  'Servo',   'Oil',     240, 20, 0, 6, 0, NULL),
('GL-01',  'Safety Gloves (pair)', 'Safety',       'Karam',   'Cotton',   60, 50, 0, 15, 0, NULL),
('GG-01',  'Safety Goggles',       'Safety',       'Karam',   'Plastic', 150, 14, 3, 5, 1, NULL);

INSERT INTO employees (emp_code, name, department, phone) VALUES
('EMP001', 'Amit Sharma',   'Production', '9810000001'),
('EMP002', 'Pooja Verma',   'Quality',    '9810000002'),
('EMP003', 'Rohit Yadav',   'Production', '9810000003'),
('EMP004', 'Neha Gupta',    'Maintenance', '9810000004'),
('EMP005', 'Sunil Kumar',   'Tool Room',  '9810000005'),
('EMP006', 'Kavita Singh',  'Store',      '9810000006');

INSERT INTO vendors (vendor_code, name, phone, address) VALUES
('VEN001', 'Shree Tool Grinding',   '9899000001', 'Sector 24, Faridabad'),
('VEN002', 'Bharat Coating Works',  '9899000002', 'Udyog Vihar, Gurugram'),
('VEN003', 'City Heat Treatment',   '9899000003', 'Sector 37, Gurugram');

INSERT INTO vendor_works (vendor_id, work_name, price)
SELECT vendor_id, 'Re-grinding', 150 FROM vendors WHERE vendor_code = 'VEN001'
UNION ALL SELECT vendor_id, 'Re-sharpening', 80 FROM vendors WHERE vendor_code = 'VEN001'
UNION ALL SELECT vendor_id, 'TiN Coating', 220 FROM vendors WHERE vendor_code = 'VEN002'
UNION ALL SELECT vendor_id, 'Black Oxide', 60 FROM vendors WHERE vendor_code = 'VEN002'
UNION ALL SELECT vendor_id, 'Hardening', 300 FROM vendors WHERE vendor_code = 'VEN003';
