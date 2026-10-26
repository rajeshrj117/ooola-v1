import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { Toaster, DialogHost, Empty, Button } from './components/ui';
import { PublicLayout, RequireRole } from './components/layout';
import { useSession } from './services/storage.service';
import { can, type Perm } from './services/workflows';
import * as Pub from './modules/public-marketplace/pages';
import * as Cus from './modules/customer-portal/pages';
import * as Own from './modules/media-owner-portal/pages';
import * as S from './modules/admin/sales';
import * as Ops from './modules/admin/ops';
import * as Fin from './modules/admin/finance';
import * as Dash from './modules/admin/dashboard';
import * as Adm from './modules/admin/admin';
import { NotificationsPage } from './modules/operations/common';
import { DisputesPage } from './modules/disputes/pages';
import { Link, useParams } from 'react-router-dom';
function QB() { const { id } = useParams(); return <S.QuotationBuilder key={id} />; }

function Guard({ perm, children }: { perm: Perm; children: ReactNode }) {
  const u = useSession();
  return can(u, perm) ? <>{children}</> : <Empty title="Access restricted for your role" body="Switch to a role with the required permission using the profile menu (demo only)." />;
}
function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }
const NotFound = () => <Empty title="Page not found" action={<Link to="/"><Button>Go home</Button></Link>} />;

export default function App() {
  return <HashRouter><ScrollTop />
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Pub.Home />} /><Route path="explore" element={<Pub.Explore />} /><Route path="asset/:id" element={<Pub.AssetDetail />} /><Route path="map" element={<Pub.MapPage />} />
        <Route path="shortlist" element={<Pub.ShortlistPage />} /><Route path="plan" element={<Pub.PublicPlan />} /><Route path="list-your-space" element={<Pub.ListYourSpace />} /><Route path="login" element={<Pub.Login />} />
      </Route>
      <Route path="customer" element={<RequireRole area="customer" />}>
        <Route index element={<Cus.CustomerDashboard />} /><Route path="plan" element={<Cus.MediaPlanning />} /><Route path="asset/:id" element={<Pub.AssetDetail portal />} />
        <Route path="campaigns" element={<Cus.CustomerCampaigns />} /><Route path="campaigns/:id" element={<Cus.CustomerCampaignDetail />} />
        <Route path="quotations" element={<Cus.CustomerQuotations />} /><Route path="quotations/:id" element={<Cus.CustomerQuotationDetail />} />
        <Route path="bookings" element={<Cus.CustomerBookings />} /><Route path="artwork" element={<Cus.CustomerArtwork />} /><Route path="reports" element={<Cus.CustomerReports />} />
        <Route path="disputes" element={<DisputesPage mode="customer" />} /><Route path="invoices" element={<Cus.CustomerInvoices />} /><Route path="invoices/:id" element={<Cus.CustomerInvoiceDetail />} /><Route path="account" element={<Cus.CustomerAccount />} /><Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="owner" element={<RequireRole area="owner" />}>
        <Route index element={<Own.OwnerDashboard />} /><Route path="inventory" element={<Own.OwnerInventory />} /><Route path="calendar" element={<Own.OwnerCalendar />} />
        <Route path="orders" element={<Own.OwnerOrders />} /><Route path="disputes" element={<DisputesPage mode="owner" />} /><Route path="proofs" element={<Own.OwnerProofs />} /><Route path="profile" element={<Own.OwnerProfile />} /><Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="admin" element={<RequireRole area="admin" />}>
        <Route index element={<Dash.AdminDashboard />} /><Route path="activity" element={<Dash.ActivityFeed />} /><Route path="intelligence" element={<Dash.Intelligence />} />
        <Route path="inventory" element={<S.AdminInventory />} /><Route path="owners" element={<S.AdminOwners />} /><Route path="verification" element={<Guard perm="verify"><S.Verification /></Guard>} />
        <Route path="calendar" element={<S.AdminCalendar />} /><Route path="map" element={<S.AdminMap />} />
        <Route path="customers" element={<Guard perm="sales"><S.AdminCustomers /></Guard>} /><Route path="brands" element={<Guard perm="sales"><S.AdminBrands /></Guard>} />
        <Route path="campaigns" element={<S.AdminCampaigns />} /><Route path="campaigns/:id" element={<S.AdminCampaignDetail />} /><Route path="planning" element={<Guard perm="sales"><S.AdminPlanning /></Guard>} />
        <Route path="quote-requests" element={<Guard perm="sales"><S.QuoteRequests /></Guard>} /><Route path="quotations" element={<Guard perm="sales"><S.AdminQuotations /></Guard>} /><Route path="quotations/:id" element={<Guard perm="sales"><QB /></Guard>} />
        <Route path="bookings" element={<S.AdminBookings />} /><Route path="disputes" element={<Guard perm="disputes"><DisputesPage mode="admin" /></Guard>} />
        <Route path="artwork" element={<Guard perm="ops"><Ops.AdminArtwork /></Guard>} /><Route path="artwork-approvals" element={<Guard perm="ops"><Ops.ArtworkApprovals /></Guard>} /><Route path="installations" element={<Guard perm="ops"><Ops.Installations /></Guard>} />
        <Route path="proofs" element={<Guard perm="ops"><Ops.Proofs /></Guard>} /><Route path="campaign-reports" element={<Ops.AdminCampaignReports />} />
        <Route path="invoices" element={<Guard perm="finance"><Fin.Invoices /></Guard>} /><Route path="invoices/:id" element={<Guard perm="finance"><Fin.InvoiceDetail /></Guard>} /><Route path="receipts" element={<Guard perm="finance"><Fin.Receipts /></Guard>} />
        <Route path="purchase-orders" element={<Guard perm="viewCosts"><Fin.PurchaseOrders /></Guard>} /><Route path="supplier-payments" element={<Guard perm="finance"><Fin.SupplierPayments /></Guard>} /><Route path="refunds" element={<Guard perm="finance"><Fin.Refunds /></Guard>} />
        <Route path="expenses" element={<Guard perm="finance"><Fin.Expenses /></Guard>} /><Route path="margins" element={<Guard perm="viewCosts"><Fin.MarginReports /></Guard>} /><Route path="reports" element={<Dash.Reports />} />
        <Route path="users" element={<Guard perm="admin"><Adm.UsersRoles /></Guard>} /><Route path="categories" element={<Guard perm="admin"><Adm.Categories /></Guard>} /><Route path="workflows" element={<Guard perm="admin"><Adm.Workflows /></Guard>} />
        <Route path="notifications" element={<NotificationsPage />} /><Route path="settings" element={<Guard perm="admin"><Adm.Settings /></Guard>} /><Route path="demo-data" element={<Guard perm="admin"><Adm.DemoData /></Guard>} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Toaster /><DialogHost />
  </HashRouter>;
}
