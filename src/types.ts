export type Role = 'Super Admin' | 'Operations Manager' | 'Sales Manager' | 'Campaign Coordinator' | 'Finance Manager' | 'Media Owner' | 'Customer' | 'Installation Staff';
export type BookingModel = 'Exclusive date-based' | 'Fleet package' | 'Vehicle route & time' | 'Shared digital capacity' | 'Publication edition';
export type VerificationStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Needs More Information';

export interface Category { id: string; name: string; description: string; enabled: boolean; formats: string[]; bookingModel: BookingModel; requiredFields: string[]; }
export interface DateBlock { id: string; from: string; to: string; status: 'Held' | 'Blocked'; reason: string; }
export interface Asset {
  disabled?: boolean; id: string; code: string; name: string; ownerId: string; categoryId: string; city: string; location: string; address: string;
  lat: number; lng: number; width: number; height: number; format: string; lighting: 'Front-lit' | 'Back-lit' | 'Non-lit' | 'Digital LED';
  rate: number; supplierRate: number; refNo?: string; mrp?: number; agencyRate?: number; minDays: number; capacity: number; images: string[]; verification: VerificationStatus;
  availability: 'Available' | 'Held' | 'Booked' | 'Blocked'; traffic: string; panels: number; blocks: DateBlock[]; verificationNote?: string;
}
export interface MediaOwner { id: string; name: string; company: string; email: string; phone: string; address: string; city: string; businessType: string; verification: 'Pending' | 'Verified (simulated)' | 'Rejected'; agreement: 'Not Sent' | 'Sent' | 'Signed (simulated)'; phoneCode?: string; altPhone?: string; website?: string; yearEstablished?: string; state?: string; pincode?: string; landmark?: string; pan?: string; gst?: string; licenceNo?: string; idType?: string; idUploaded?: boolean; onboardingComplete?: boolean; onboardedAt?: string; }
export interface Contact { disabled?: boolean; name: string; email: string; role: string; }
export interface Customer { id: string; company: string; contact: string; email: string; phone: string; city: string; industry: string; gstin: string; contacts: Contact[]; }
export interface Brand { disabled?: boolean; id: string; customerId: string; name: string; category: string; }
export interface Campaign { id: string; customerId: string; brandId: string; name: string; start: string; end: string; budget: number; status: 'Planning' | 'Quotation' | 'Booked' | 'Live' | 'Completed' | 'Cancelled'; assetIds: string[]; notes: string; }
export interface QuoteItem { assetId: string; start: string; end: string; rate: number; supplierCost: number; }
export type QuoteStatus = 'Requested' | 'Draft' | 'Sent' | 'Revision Requested' | 'Approved' | 'Rejected' | 'Expired';
export interface Quotation {
  disabled?: boolean;
  id: string; number: string; campaignId: string; customerId: string; status: QuoteStatus; items: QuoteItem[];
  production: number; installation: number; service: number; productionCost: number; installationCost: number; otherCost: number;
  discount: number; taxRate: number; expiry: string; createdAt: string; notes: string; internalApproved?: boolean;
}
export type BookingStatus = 'Enquiry' | 'Quotation in Progress' | 'Quotation Sent' | 'Awaiting Customer Approval' | 'Awaiting Supplier Confirmation' | 'Confirmed' | 'Artwork Pending' | 'Scheduled' | 'Installation in Progress' | 'Live' | 'Completed' | 'Cancelled';
export interface Booking { id: string; number: string; quotationId: string; campaignId: string; customerId: string; assetId: string; ownerId: string; start: string; end: string; amount: number; supplierCost: number; status: BookingStatus; createdAt: string; }
export type ArtworkStatus = 'Awaiting Upload' | 'Submitted' | 'Under Review' | 'Approved' | 'Revisions Requested' | 'Rejected';
export interface HistoryEntry { at: string; by: string; action: string; note?: string; }
export interface Artwork { id: string; campaignId: string; bookingId?: string; name: string; fileName: string; fileSize: number; fileType: string; fileKey?: string; preview?: string; version: number; status: ArtworkStatus; submittedAt: string; history: HistoryEntry[]; }
export type InstallStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Delayed' | 'Issue Reported';
export interface Installation { id: string; campaignId: string; bookingId: string; assetId: string; scheduled: string; assignee: string; supplierId: string; instructions: string; status: InstallStatus; completedAt: string; notes: string; }
export type ProofStatus = 'Pending Upload' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
export interface Proof { id: string; installationId: string; assetId: string; campaignId: string; captureDate: string; image: string; fileKey?: string; notes: string; status: ProofStatus; reason: string; }
export type POStatus = 'Draft' | 'Sent' | 'Confirmed' | 'Rejected' | 'In Execution' | 'Fulfilled';
export interface LineItem { desc: string; amount: number; }
export interface PurchaseOrder { id: string; number: string; ownerId: string; bookingId: string; campaignId: string; items: LineItem[]; status: POStatus; reason: string; createdAt: string; }
export type InvoiceStatus = 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Cancelled';
export interface Invoice { disabled?: boolean; id: string; number: string; customerId: string; campaignId: string; issue: string; due: string; items: LineItem[]; taxRate: number; discount: number; status: InvoiceStatus; }
export interface Receipt { disabled?: boolean; id: string; number: string; invoiceId: string; amount: number; date: string; method: string; }
export interface SupplierPayment { id: string; poId: string; amount: number; date: string; method: string; reference: string; }
export interface Expense { id: string; campaignId: string; type: 'Production' | 'Installation' | 'Other'; description: string; amount: number; date: string; }
export interface Refund { id: string; invoiceId: string; amount: number; reason: string; status: 'Requested' | 'Approved' | 'Rejected'; history: HistoryEntry[]; }
export type DisputeCategory = 'Installation quality' | 'Proof of advertising' | 'Payment / invoice' | 'Refund' | 'Availability / double booking' | 'Artwork / creative' | 'Supplier no-show' | 'Other';
export type DisputeStatus = 'Open' | 'Under Review' | 'Awaiting Information' | 'Resolved' | 'Closed';
export interface DisputeMessage { at: string; by: string; role: 'Customer' | 'Media Owner' | 'Staff'; text: string; internal?: boolean; }
export interface Dispute {
  id: string; number: string; raisedBy: 'Customer' | 'Media Owner' | 'Staff'; customerId?: string; ownerId?: string;
  bookingId?: string; invoiceId?: string; poId?: string; campaignId?: string;
  category: DisputeCategory; subject: string; description: string; priority: 'Low' | 'Medium' | 'High'; status: DisputeStatus;
  assignee: string; resolution: string; createdAt: string; updatedAt: string; slaDue: string; thread: DisputeMessage[];
}
export const MAX_PHOTOS = 5;
export interface User { id: string; name: string; email: string; role: Role; ownerId?: string; customerId?: string; active: boolean; }
export interface Notification { disabled?: boolean; id: string; audience: 'internal' | 'customer' | 'owner'; targetId?: string; title: string; body: string; link: string; read: boolean; at: string; }
export interface AuditEvent { id: string; at: string; user: string; action: string; entity: string; entityId: string; summary: string; }
export interface Settings { companyName: string; taxRate: number; quoteValidityDays: number; currency: 'INR'; invoiceDueDays: number; gstNote: string; workflows: { requireInternalQuoteApproval: boolean; requireProofApproval: boolean; requireArtworkApproval: boolean }; }

export interface DB {
  schemaVersion: number; seededAt: string;
  categories: Category[]; assets: Asset[]; owners: MediaOwner[]; customers: Customer[]; brands: Brand[]; campaigns: Campaign[];
  quotations: Quotation[]; bookings: Booking[]; artworks: Artwork[]; installations: Installation[]; proofs: Proof[];
  purchaseOrders: PurchaseOrder[]; invoices: Invoice[]; receipts: Receipt[]; supplierPayments: SupplierPayment[]; expenses: Expense[];
  refunds: Refund[]; disputes: Dispute[]; users: User[]; notifications: Notification[]; audit: AuditEvent[]; settings: Settings;
}
export type CollectionKey = Exclude<keyof DB, 'schemaVersion' | 'seededAt' | 'settings'>;
