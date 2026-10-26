import type { DB, Asset, Category, MediaOwner, Customer, Brand, Campaign, Quotation, Booking, Artwork, Installation, Proof, PurchaseOrder, Invoice, Receipt, SupplierPayment, Expense, User, Notification, Refund, Dispute, BookingStatus } from '../types';
import { addDays, today, prorate, quoteTotals } from '../utils';

export const SCHEMA_VERSION = 2;
const P = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200`;
export const IMAGES = [P(33644177), P(29849362), P(5102100), P(1827234), P(14780175), P(29020287), P(28119461), P(16783119)];

export const CATEGORY_NAMES = ['Hoardings and Billboards', 'Bus Shelters', 'Bus and Vehicle Branding', 'Digital Advertising Screens', 'Street Furniture', 'Metro and Rail', 'Airports', 'Malls and Retail Spaces', 'Autos and Taxis', 'Mobile Advertising Vans', 'Cinema Advertising', 'Print and Inflight Advertising'];
const MODELS: Category['bookingModel'][] = ['Exclusive date-based', 'Exclusive date-based', 'Fleet package', 'Shared digital capacity', 'Exclusive date-based', 'Exclusive date-based', 'Exclusive date-based', 'Exclusive date-based', 'Fleet package', 'Vehicle route & time', 'Shared digital capacity', 'Publication edition'];
const FORMATS = [['Front-lit Flex', 'Back-lit Flex', 'Unipole', 'Gantry'], ['Shelter Panel', 'Back-lit Panel'], ['Full Wrap', 'Rear Panel', 'Side Panel'], ['LED Screen', 'LCD Network'], ['Kiosk', 'Pole Kiosk'], ['Station Panel', 'Train Wrap'], ['Arrival Panel', 'Baggage Belt'], ['Atrium Drop', 'Standee'], ['Auto Hood', 'Taxi Top'], ['Van Branding'], ['On-screen Slot'], ['Magazine Page']];

const cats: Category[] = CATEGORY_NAMES.map((name, i) => ({ id: `cat_${i + 1}`, name, description: `${name} advertising inventory across Indian cities.`, enabled: i < 4, formats: FORMATS[i], bookingModel: MODELS[i], requiredFields: ['dimensions', 'format', 'rate'] }));

const ownerSeed = [['Ravi Kumar', 'Skyline Media Works (Demo)', 'Chennai'], ['Lakshmi Narayan', 'Marina Outdoors (Demo)', 'Chennai'], ['Arjun Rao', 'Deccan Hoardings (Demo)', 'Hyderabad'], ['Priya Menon', 'Garden City OOH (Demo)', 'Bengaluru'], ['Senthil Velan', 'Kovai Ads Pvt (Demo)', 'Coimbatore'], ['Farhan Ali', 'MetroVue Displays (Demo)', 'Chennai'], ['Deepa Iyer', 'Transit Brand Co (Demo)', 'Chennai'], ['Karthik S', 'Coastal Signage (Demo)', 'Chennai'], ['Meera Joshi', 'Pixel Street Media (Demo)', 'Bengaluru'], ['Vikram Reddy', 'Charminar Outdoor (Demo)', 'Hyderabad']];
const owners: MediaOwner[] = ownerSeed.map(([name, company, city], i) => ({ id: `own_${i + 1}`, name, company, city, email: i === 0 ? 'owner@oolaa.demo' : `owner${i + 1}@example.demo`, phone: `+91 98400 ${String(10000 + i * 137).slice(0, 5)}`, address: `${12 + i}, Demo Street, ${city}`, businessType: i % 3 === 0 ? 'Private Limited' : i % 3 === 1 ? 'Proprietorship' : 'Partnership', verification: i < 8 ? 'Verified (simulated)' : 'Pending', agreement: i < 7 ? 'Signed (simulated)' : 'Sent' }));

// [name, location, city, lat, lng, cat, w, h, rate, owner]
const assetSeed: [string, string, string, number, number, number, number, number, number, number][] = [
  ['Anna Salai Gemini Flyover Hoarding', 'Anna Salai', 'Chennai', 13.0569, 80.2497, 1, 40, 20, 185000, 1],
  ['OMR Thoraipakkam Unipole', 'OMR', 'Chennai', 12.9407, 80.2337, 1, 30, 15, 140000, 1],
  ['T. Nagar Pondy Bazaar Gantry', 'T. Nagar', 'Chennai', 13.0418, 80.2341, 1, 60, 10, 210000, 2],
  ['Velachery Phoenix Junction Billboard', 'Velachery', 'Chennai', 12.9915, 80.2186, 1, 40, 20, 160000, 2],
  ['Guindy Kathipara Mega Hoarding', 'Guindy', 'Chennai', 13.0067, 80.2206, 1, 50, 25, 230000, 6],
  ['Adyar Signal Bus Shelter', 'Adyar', 'Chennai', 13.0012, 80.2565, 2, 12, 6, 45000, 7],
  ['ECR Neelankarai Backlit Hoarding', 'ECR', 'Chennai', 12.9496, 80.2593, 1, 30, 15, 120000, 8],
  ['Porur Junction Bus Shelter', 'Porur', 'Chennai', 13.0382, 80.1565, 2, 12, 6, 38000, 7],
  ['Tambaram Station Road Hoarding', 'Tambaram', 'Chennai', 12.9249, 80.1000, 1, 40, 20, 110000, 1],
  ['Chennai Central LED Screen', 'Chennai Central', 'Chennai', 13.0827, 80.2757, 4, 20, 12, 175000, 6],
  ['MTC City Bus Fleet Wrap (10 buses)', 'City-wide routes', 'Chennai', 13.0600, 80.2400, 3, 35, 9, 250000, 7],
  ['OMR Sholinganallur Digital Screen', 'OMR', 'Chennai', 12.9010, 80.2279, 4, 24, 12, 150000, 6],
  ['Avinashi Road Gantry', 'Avinashi Road', 'Coimbatore', 11.0168, 76.9558, 1, 60, 10, 115000, 5],
  ['Gandhipuram Bus Shelter', 'Gandhipuram', 'Coimbatore', 11.0183, 76.9725, 2, 12, 6, 30000, 5],
  ['MG Road LED Wall', 'MG Road', 'Bengaluru', 12.9756, 77.6050, 4, 30, 15, 220000, 4],
  ['Outer Ring Road Marathahalli Hoarding', 'ORR Marathahalli', 'Bengaluru', 12.9569, 77.7011, 1, 40, 20, 195000, 9],
  ['Koramangala Bus Shelter', 'Koramangala', 'Bengaluru', 12.9352, 77.6245, 2, 12, 6, 48000, 4],
  ['HITEC City Flyover Hoarding', 'HITEC City', 'Hyderabad', 17.4435, 78.3772, 1, 40, 20, 205000, 3],
  ['Banjara Hills Digital Screen', 'Banjara Hills', 'Hyderabad', 17.4126, 78.4482, 4, 20, 10, 160000, 10],
  ['Hyderabad Auto Fleet Branding (50 autos)', 'City-wide', 'Hyderabad', 17.3850, 78.4867, 3, 4, 3, 90000, 10],
  ['Chennai Metro Guindy Station Panel', 'Guindy', 'Chennai', 13.0090, 80.2130, 6, 10, 6, 60000, 6],
  ['Phoenix Mall Atrium Drop', 'Velachery', 'Chennai', 12.9920, 80.2170, 8, 20, 30, 95000, 2],
];
const traffic = ['Very high vehicular traffic, ~2.5 lakh daily impressions (illustrative)', 'IT corridor commuters, peak hour visibility', 'Dense retail footfall, shopping district', 'Signal-stop dwell time ~90 seconds', 'Arterial road with long approach visibility'];
const assets: Asset[] = assetSeed.map(([name, location, city, lat, lng, cat, w, h, rate, own], i) => ({
  id: `ast_${i + 1}`, code: `OOL-${city.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`, name: name + '', ownerId: `own_${own}`, categoryId: `cat_${cat}`, city, location, address: `${location}, ${city} (sample location)`,
  lat, lng, width: w, height: h, format: FORMATS[cat - 1][i % FORMATS[cat - 1].length], lighting: cat === 4 ? 'Digital LED' : i % 3 === 0 ? 'Front-lit' : i % 3 === 1 ? 'Back-lit' : 'Non-lit',
  rate, supplierRate: Math.round(rate * 0.72 / 1000) * 1000, minDays: cat === 4 ? 7 : 30, capacity: cat === 4 ? 6 : 1, images: [IMAGES[i % 8], IMAGES[(i + 3) % 8], IMAGES[(i + 5) % 8]],
  verification: i < 18 ? 'Approved' : i === 18 ? 'Under Review' : i === 19 ? 'Submitted' : 'Approved', availability: 'Available', traffic: traffic[i % 5], panels: cat === 3 ? 10 : 1, blocks: i === 3 ? [{ id: 'blk_1', from: addDays(today(), 50), to: addDays(today(), 60), status: 'Blocked', reason: 'Structure maintenance' }] : [],
}));

const custSeed = [['Kaveri Foods (Demo)', 'FMCG', 'Chennai'], ['Bluewave Telecom (Demo)', 'Telecom', 'Bengaluru'], ['Sundaram Motors (Demo)', 'Automotive', 'Chennai'], ['Lotus Jewellers (Demo)', 'Retail', 'Chennai'], ['Nimbus Realty (Demo)', 'Real Estate', 'Hyderabad'], ['EduSpark Academy (Demo)', 'Education', 'Coimbatore'], ['UrbanFit Gyms (Demo)', 'Fitness', 'Chennai'], ['Peacock Silks (Demo)', 'Apparel', 'Chennai'], ['CloudNine Hospitals (Demo)', 'Healthcare', 'Bengaluru'], ['Spice Route Restaurants (Demo)', 'F&B', 'Chennai'], ['Velocity Bikes (Demo)', 'Automotive', 'Hyderabad'], ['Greenleaf Organics (Demo)', 'FMCG', 'Coimbatore']];
const contactNames = ['Anitha R', 'Rahul Shetty', 'Suresh Babu', 'Kavya N', 'Imran Khan', 'Divya P', 'Gokul M', 'Revathi S', 'Nikhil Jain', 'Sanjay V', 'Pooja Rao', 'Harini K'];
const customers: Customer[] = custSeed.map(([company, industry, city], i) => ({ id: `cus_${i + 1}`, company, industry, city, contact: contactNames[i], email: i === 0 ? 'customer@oolaa.demo' : `marketing${i + 1}@example.demo`, phone: `+91 99620 ${String(20000 + i * 211).slice(0, 5)}`, gstin: `33DEMO${1000 + i}X1Z${i % 9}`, contacts: [{ name: contactNames[i], email: `contact${i + 1}@example.demo`, role: 'Marketing Head' }] }));
const brands: Brand[] = customers.flatMap((c, i) => [{ id: `brd_${i * 2 + 1}`, customerId: c.id, name: c.company.replace(' (Demo)', ''), category: c.industry }, ...(i < 6 ? [{ id: `brd_${i * 2 + 2}`, customerId: c.id, name: c.company.split(' ')[0] + ' Plus', category: c.industry }] : [])]);

// Campaigns: [customerIdx, offsetStart, days, status, bookingStatus, assetIdxs]
const T = today();
const campSeed: [number, number, number, Campaign['status'], BookingStatus, number[]][] = [
  [0, -40, 60, 'Live', 'Live', [0, 5]], [1, -90, 30, 'Completed', 'Completed', [14, 16]], [2, -10, 45, 'Live', 'Installation in Progress', [4, 2]],
  [3, 7, 30, 'Booked', 'Scheduled', [3, 21]], [4, 15, 30, 'Booked', 'Artwork Pending', [17, 19]], [5, 20, 30, 'Booked', 'Confirmed', [12, 13]],
  [6, 25, 30, 'Booked', 'Awaiting Supplier Confirmation', [7]], [7, 30, 30, 'Quotation', 'Quotation Sent', [6, 8]], [8, 35, 30, 'Quotation', 'Quotation in Progress', [15]],
  [9, 40, 30, 'Planning', 'Enquiry', [1, 11]], [10, -70, 30, 'Completed', 'Completed', [18]], [11, 45, 30, 'Quotation', 'Awaiting Customer Approval', [12]],
  [0, 60, 30, 'Planning', 'Enquiry', [9]], [2, -60, 30, 'Completed', 'Completed', [10]], [3, -5, 30, 'Live', 'Live', [9]],
];
const campaigns: Campaign[] = []; const quotations: Quotation[] = []; const bookings: Booking[] = [];
const qStatusFor = (b: BookingStatus): Quotation['status'] => b === 'Enquiry' ? 'Requested' : b === 'Quotation in Progress' ? 'Draft' : b === 'Quotation Sent' || b === 'Awaiting Customer Approval' ? 'Sent' : 'Approved';
campSeed.forEach(([ci, off, days, status, bs, ais], i) => {
  const start = addDays(T, off), end = addDays(T, off + days - 1);
  const cust = customers[ci]; const brand = brands.find(b => b.customerId === cust.id)!;
  const id = `cmp_${i + 1}`;
  campaigns.push({ id, customerId: cust.id, brandId: brand.id, name: `${brand.name} ${['Summer Launch', 'Festive Push', 'Brand Recall', 'New Store Opening', 'Monsoon Offer'][i % 5]}`, start, end, budget: ais.reduce((s, a) => s + assets[a].rate, 0) * 1.4, status, assetIds: ais.map(a => assets[a].id), notes: 'Demo campaign' });
  const items = ais.map(a => ({ assetId: assets[a].id, start, end, rate: prorate(assets[a].rate, start, end), supplierCost: prorate(assets[a].supplierRate, start, end) }));
  const qid = `quo_${i + 1}`;
  quotations.push({ id: qid, number: `OQ-2025-${String(i + 1).padStart(4, '0')}`, campaignId: id, customerId: cust.id, status: qStatusFor(bs), items, production: 18000 * ais.length, installation: 8000 * ais.length, service: 10000, productionCost: 12000 * ais.length, installationCost: 5000 * ais.length, otherCost: 2000, discount: i % 3 === 0 ? 10000 : 0, taxRate: 18, expiry: addDays(T, i === 7 ? -2 : 14), createdAt: addDays(start, -20), notes: '' });
  const bookable = !['Enquiry', 'Quotation in Progress', 'Quotation Sent', 'Awaiting Customer Approval'].includes(bs);
  if (bookable) ais.forEach((a, k) => bookings.push({ id: `bkg_${bookings.length + 1}`, number: `OB-2025-${String(bookings.length + 1).padStart(4, '0')}`, quotationId: qid, campaignId: id, customerId: cust.id, assetId: assets[a].id, ownerId: assets[a].ownerId, start, end, amount: items[k].rate, supplierCost: items[k].supplierCost, status: bs, createdAt: addDays(start, -15) }));
});
// extra quote variants for comparison (line items > 25)
quotations.push({ ...quotations[7], id: 'quo_16', number: 'OQ-2025-0016', items: quotations[7].items.slice(0, 1), discount: 5000, status: 'Sent', notes: 'Alternative single-site option' });
quotations.push({ ...quotations[11], id: 'quo_17', number: 'OQ-2025-0017', status: 'Revision Requested', notes: 'Customer asked for lower production cost' });

const artworks: Artwork[] = [];
const awStatus: Artwork['status'][] = ['Approved', 'Approved', 'Submitted', 'Under Review', 'Revisions Requested', 'Approved', 'Awaiting Upload', 'Rejected'];
bookings.concat(bookings.slice(0, 4)).slice(0, 20).forEach((b, i) => {
  const st = awStatus[i % 8];
  artworks.push({ id: `art_${i + 1}`, campaignId: b.campaignId, bookingId: b.id, name: `Creative ${i + 1} – ${assets.find(a => a.id === b.assetId)!.format}`, fileName: st === 'Awaiting Upload' ? '' : `creative_${i + 1}_v${i % 3 + 1}.jpg`, fileSize: st === 'Awaiting Upload' ? 0 : 1200000 + i * 33000, fileType: 'image/jpeg', preview: st === 'Awaiting Upload' ? '' : IMAGES[(i + 2) % 8], version: (i % 3) + 1, status: st, submittedAt: addDays(b.start, -10), history: [{ at: addDays(b.start, -10), by: 'Customer', action: 'Uploaded' }, ...(st === 'Approved' ? [{ at: addDays(b.start, -8), by: 'Campaign Coordinator', action: 'Approved' }] : st === 'Revisions Requested' ? [{ at: addDays(b.start, -8), by: 'Campaign Coordinator', action: 'Revisions Requested', note: 'Increase logo size' }] : st === 'Rejected' ? [{ at: addDays(b.start, -8), by: 'Campaign Coordinator', action: 'Rejected', note: 'Wrong dimensions' }] : [])] });
});

const installations: Installation[] = []; const proofs: Proof[] = [];
const staff = ['Murugan (Installer)', 'Selvam (Installer)', 'Ajay (Coordinator)'];
bookings.filter(b => !['Awaiting Supplier Confirmation', 'Confirmed'].includes(b.status)).concat(bookings.filter(b => b.status === 'Confirmed')).slice(0, 15).forEach((b, i) => {
  const done = ['Live', 'Completed'].includes(b.status);
  const st: Installation['status'] = done ? 'Completed' : b.status === 'Installation in Progress' ? 'In Progress' : b.start < T ? 'Delayed' : 'Scheduled';
  const a = assets.find(x => x.id === b.assetId)!;
  installations.push({ id: `ins_${i + 1}`, campaignId: b.campaignId, bookingId: b.id, assetId: b.assetId, scheduled: addDays(b.start, -1), assignee: staff[i % 3], supplierId: b.ownerId, instructions: 'Mount flex, check lighting, capture day & night photos.', status: st, completedAt: done ? addDays(b.start, -1) : '', notes: '' });
  const n = done ? 3 : st === 'In Progress' ? 2 : 1;
  for (let k = 0; k < n && proofs.length < 32; k++) proofs.push({ id: `prf_${proofs.length + 1}`, installationId: `ins_${i + 1}`, assetId: b.assetId, campaignId: b.campaignId, captureDate: done ? addDays(b.start, k) : '', image: done || st === 'In Progress' ? a.images[k % 3] : '', notes: k === 0 ? 'Day shot' : k === 1 ? 'Night shot' : 'Close-up', status: done ? (k === 2 && i % 2 ? 'Under Review' : 'Approved') : st === 'In Progress' ? 'Submitted' : 'Pending Upload', reason: '' });
});

const purchaseOrders: PurchaseOrder[] = bookings.slice(0, 15).map((b, i) => ({ id: `po_${i + 1}`, number: `OPO-2025-${String(i + 1).padStart(4, '0')}`, ownerId: b.ownerId, bookingId: b.id, campaignId: b.campaignId, items: [{ desc: `Media display – ${assets.find(a => a.id === b.assetId)!.name}`, amount: b.supplierCost }], status: b.status === 'Awaiting Supplier Confirmation' ? 'Sent' : ['Live', 'Completed'].includes(b.status) ? 'Fulfilled' : ['Installation in Progress', 'Scheduled'].includes(b.status) ? 'In Execution' : 'Confirmed', reason: '', createdAt: b.createdAt }));

const invoices: Invoice[] = []; const receipts: Receipt[] = [];
const invCamps = campaigns.filter(c => ['Live', 'Completed', 'Booked'].includes(c.status));
for (let i = 0; i < 20; i++) {
  const c = invCamps[i % invCamps.length]; const q = quotations.find(x => x.campaignId === c.id)!; const t = quoteTotals(q);
  const half = i >= invCamps.length; const issue = addDays(c.start, half ? 15 : -5);
  const amt = Math.round(t.discounted / 2);
  const status: Invoice['status'] = i % 7 === 6 ? 'Draft' : 'Issued';
  invoices.push({ id: `inv_${i + 1}`, number: `OI-2025-${String(i + 1).padStart(4, '0')}`, customerId: c.customerId, campaignId: c.id, issue, due: addDays(issue, 30), items: [{ desc: `${half ? 'Second' : 'First'} instalment – ${c.name}`, amount: amt }], taxRate: 18, discount: 0, status });
  if (status === 'Issued' && i % 3 !== 2) { const total = Math.round(amt * 1.18); const full = i % 3 === 0; receipts.push({ id: `rcp_${receipts.length + 1}`, number: `ORC-2025-${String(receipts.length + 1).padStart(4, '0')}`, invoiceId: `inv_${i + 1}`, amount: full ? total : Math.round(total / 2), date: addDays(issue, 10), method: ['NEFT', 'UPI', 'Cheque'][i % 3] }); if (full) invoices[i].status = 'Paid'; else invoices[i].status = 'Partially Paid'; }
}
const supplierPayments: SupplierPayment[] = purchaseOrders.filter(p => ['Fulfilled', 'In Execution'].includes(p.status)).map((p, i) => ({ id: `spm_${i + 1}`, poId: p.id, amount: p.status === 'Fulfilled' ? p.items[0].amount : Math.round(p.items[0].amount / 2), date: addDays(p.createdAt, 20), method: 'NEFT', reference: `UTR${100200 + i}` }));
const expenses: Expense[] = Array.from({ length: 18 }, (_, i) => { const c = campaigns[i % 15]; return { id: `exp_${i + 1}`, campaignId: c.id, type: (['Production', 'Installation', 'Other'] as const)[i % 3], description: ['Flex printing', 'Mounting crew & crane', 'Permit & municipal fee', 'Vinyl wrap printing', 'Night lighting check', 'Transport'][i % 6], amount: 4000 + (i * 1750) % 16000, date: addDays(c.start, -3) }; });
const refunds: Refund[] = [{ id: 'ref_1', invoiceId: 'inv_1', amount: 5000, reason: 'Lighting outage for 3 days (demo)', status: 'Requested', history: [{ at: T, by: 'Finance Manager', action: 'Requested' }] }];

const users: User[] = [
  ['Aisha Admin', 'admin@oolaa.demo', 'Super Admin'], ['Omkar Ops', 'operations@oolaa.demo', 'Operations Manager'], ['Sana Sales', 'sales@oolaa.demo', 'Sales Manager'], ['Faisal Finance', 'finance@oolaa.demo', 'Finance Manager'],
  ['Ravi Kumar', 'owner@oolaa.demo', 'Media Owner'], ['Anitha R', 'customer@oolaa.demo', 'Customer'], ['Ajay Coordinator', 'coordinator@oolaa.demo', 'Campaign Coordinator'], ['Murugan Installer', 'install@oolaa.demo', 'Installation Staff'],
  ['Lakshmi Narayan', 'owner2@example.demo', 'Media Owner'], ['Rahul Shetty', 'marketing2@example.demo', 'Customer'], ['Selvam Installer', 'install2@oolaa.demo', 'Installation Staff'], ['Nisha Sales', 'sales2@oolaa.demo', 'Sales Manager'],
].map(([name, email, role], i) => ({ id: `usr_${i + 1}`, name, email, role: role as User['role'], active: true, ownerId: email === 'owner@oolaa.demo' ? 'own_1' : email === 'owner2@example.demo' ? 'own_2' : undefined, customerId: email === 'customer@oolaa.demo' ? 'cus_1' : email === 'marketing2@example.demo' ? 'cus_2' : undefined }));

const nSeed: [Notification['audience'], string, string, string][] = [
  ['internal', 'New quotation request', 'Spice Route Restaurants requested a quote for 2 sites', '/admin/quotations'], ['internal', 'Asset submitted for verification', 'Banjara Hills Digital Screen awaits review', '/admin/verification'],
  ['internal', 'Invoice overdue', 'An invoice has passed its due date', '/admin/invoices'], ['internal', 'Installation delayed', 'Check installation tasks flagged as delayed', '/admin/installations'],
  ['internal', 'Supplier confirmation pending', 'UrbanFit booking awaits media owner confirmation', '/admin/bookings'], ['internal', 'Proof submitted', 'New proof photos for review', '/admin/proofs'],
  ['internal', 'Artwork submitted', 'Lotus Jewellers uploaded a creative', '/admin/artwork-approvals'], ['internal', 'Refund requested', 'Refund request on OI-2025-0001', '/admin/refunds'],
  ['internal', 'Payment recorded', 'Receipt recorded against OI-2025-0004', '/admin/receipts'], ['internal', 'Quotation revision requested', 'Greenleaf Organics asked for a revision', '/admin/quotations'],
  ['customer', 'Quotation ready for review', 'OQ-2025-0012 is awaiting your approval', '/customer/quotations'], ['customer', 'Booking confirmed', 'Your Anna Salai booking is confirmed', '/customer/bookings'],
  ['customer', 'Proof approved', 'New proof-of-advertising photos are available', '/customer/reports'], ['customer', 'Invoice issued', 'Invoice OI-2025-0001 issued', '/customer/invoices'],
  ['customer', 'Artwork revision requested', 'Please increase logo size', '/customer/artwork'], ['owner', 'New purchase order', 'You have a purchase order awaiting confirmation', '/owner/orders'],
  ['owner', 'Asset approved', 'Anna Salai Gemini Flyover Hoarding verified (simulated)', '/owner/inventory'], ['owner', 'Upcoming installation', 'Installation scheduled at Tambaram', '/owner/orders'],
  ['owner', 'Supplier payment recorded', 'Payment recorded against OPO-2025-0001', '/owner/orders'], ['owner', 'Enquiry received', 'New availability enquiry on OMR Unipole', '/owner/calendar'],
];
const notifications: Notification[] = nSeed.map(([audience, title, body, link], i) => ({ id: `ntf_${i + 1}`, audience, targetId: audience === 'customer' ? 'cus_1' : audience === 'owner' ? 'own_1' : undefined, title, body, link, read: i % 4 === 3, at: new Date(Date.now() - i * 3600000 * 5).toISOString() }));

const disputes: Dispute[] = (() => {
  const iso = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const b1 = bookings.find(b => b.customerId === 'cus_1'); const b2 = bookings.find(b => b.customerId === 'cus_2'); const b3 = bookings.find(b => b.ownerId === 'own_1');
  const mk = (n: number, d: Omit<Dispute, 'id' | 'number' | 'slaDue' | 'updatedAt'> & { ago: number }): Dispute => { const { ago, ...r } = d; return { ...r, id: `dsp_${n}`, number: `ODS-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`, slaDue: addDays(r.createdAt.slice(0, 10), r.priority === 'High' ? 2 : r.priority === 'Medium' ? 5 : 10), updatedAt: iso(ago) }; };
  const out: Dispute[] = [];
  if (b1) out.push(mk(1, { ago: 1, raisedBy: 'Customer', customerId: b1.customerId, ownerId: b1.ownerId, bookingId: b1.id, campaignId: b1.campaignId, category: 'Installation quality', subject: 'Creative looks faded after one week', description: 'The flex printing at this site appears faded and the bottom edge is peeling. Please inspect and re-install if needed.', priority: 'High', status: 'Under Review', assignee: 'Omkar Ops', resolution: '', createdAt: iso(3), thread: [{ at: iso(3), by: 'Anitha R', role: 'Customer', text: 'Photos attached in the portal. The colour is much lighter than the approved proof.' }, { at: iso(2), by: 'Omkar Ops', role: 'Staff', text: 'We have asked the media owner for a site inspection.' }, { at: iso(2), by: 'Omkar Ops', role: 'Staff', internal: true, text: 'Check supplier warranty on printing before agreeing to re-print cost.' }] }));
  if (b2) out.push(mk(2, { ago: 5, raisedBy: 'Customer', customerId: b2.customerId, ownerId: b2.ownerId, bookingId: b2.id, campaignId: b2.campaignId, category: 'Payment / invoice', subject: 'Invoice total does not match quotation', description: 'The invoice shows a service charge that was not in the approved quotation.', priority: 'Medium', status: 'Resolved', assignee: 'Faisal Finance', resolution: 'Service charge was added in error. Invoice corrected and a credit note issued (demo).', createdAt: iso(12), thread: [{ at: iso(12), by: 'Rahul Shetty', role: 'Customer', text: 'Please check the service charges line.' }, { at: iso(5), by: 'Faisal Finance', role: 'Staff', text: 'Confirmed — corrected. Marking as resolved.' }] }));
  if (b3) out.push(mk(3, { ago: 0, raisedBy: 'Media Owner', ownerId: b3.ownerId, customerId: b3.customerId, bookingId: b3.id, campaignId: b3.campaignId, category: 'Proof of advertising', subject: 'Proof rejected without reason', description: 'Our installation proof was rejected but no reason was shown. Please share what is missing.', priority: 'Low', status: 'Open', assignee: 'Unassigned', resolution: '', createdAt: iso(1), thread: [{ at: iso(1), by: 'Ravi Kumar', role: 'Media Owner', text: 'Could you let us know which photo is unclear so we can re-upload?' }] }));
  return out;
})();

export function buildSeed(): DB {
  return {
    schemaVersion: SCHEMA_VERSION, seededAt: new Date().toISOString(),
    categories: cats, assets, owners, customers, brands, campaigns, quotations, bookings, artworks, installations, proofs, purchaseOrders, invoices, receipts, supplierPayments, expenses, refunds, disputes, users, notifications,
    audit: [{ id: 'aud_1', at: new Date().toISOString(), user: 'System', action: 'Seeded', entity: 'Demo', entityId: '-', summary: 'Demo dataset initialised' }],
    settings: { companyName: 'Oolaa.in (Demo)', taxRate: 18, quoteValidityDays: 15, currency: 'INR', invoiceDueDays: 30, gstNote: 'GST at 18% is a configurable demo assumption and requires professional validation.', workflows: { requireInternalQuoteApproval: false, requireProofApproval: true, requireArtworkApproval: true } },
  };
}
