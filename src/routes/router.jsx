/**
 * Application routes: the public portal, sign-in and account pages, the researcher area and the staff interface.
 * Pages are loaded on demand to keep the first download small, and staff pages are wrapped in the permission
 * guards.
 *
 * @author Kwasi Adabo Boakye
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, useRouteError, Link } from 'react-router-dom';
import { PublicLayout } from '../features/public/PublicLayout.jsx';
import { AdminLayout } from '../components/layout/AdminLayout.jsx';
import { RequireAuth, RequireStaff, RequirePerm } from './guards.jsx';
import { PageLoader, ErrorState, Button } from '../components/ui/index.js';

/**
 * Creates a lazily loaded page component from a module, optionally from a named export.
 *
 * @param {() => Promise<object>} factory Dynamic import of the module.
 * @param {string} [name='default'] Export to use.
 * @returns {import('react').LazyExoticComponent}
 */
const lazyComponent = (factory, name = 'default') => lazy(() => factory().then((m) => ({ default: m[name] })));

/**
 * Builds the element for a route: the page with a loading placeholder, wrapped in a permission check when
 * permissions are given.
 *
 * @param {import('react').ComponentType} Comp The page component.
 * @param {string[]} [any] Permissions, any one of which grants access.
 * @returns {JSX.Element}
 */
const pageElement = (Comp, any) => {
  const el = (
    <Suspense fallback={<PageLoader />}>
      <Comp />
    </Suspense>
  );
  return any ? <RequirePerm any={any}>{el}</RequirePerm> : el;
};

// Public & auth
const Home = lazyComponent(() => import('../features/public/HomePage.jsx'));
const Search = lazyComponent(() => import('../features/public/SearchPage.jsx'));
const Collections = lazyComponent(() => import('../features/public/CollectionsPage.jsx'));
const Record = lazyComponent(() => import('../features/public/RecordPage.jsx'));
const FindingAid = lazyComponent(() => import('../features/public/FindingAidPage.jsx'));
const Request = lazyComponent(() => import('../features/public/RequestPage.jsx'));
const Help = lazyComponent(() => import('../features/public/HelpPage.jsx'));
const Login = lazyComponent(() => import('../features/authentication/LoginPage.jsx'));
const Register = lazyComponent(() => import('../features/authentication/RegisterPage.jsx'));
const Verify = lazyComponent(() => import('../features/authentication/TokenPages.jsx'), 'VerifyEmailPage');
const Activate = lazyComponent(() => import('../features/authentication/TokenPages.jsx'), 'ActivatePage');
const Forgot = lazyComponent(() => import('../features/authentication/TokenPages.jsx'), 'ForgotPasswordPage');
const Reset = lazyComponent(() => import('../features/authentication/TokenPages.jsx'), 'ResetPasswordPage');
const MyResearch = lazyComponent(() => import('../features/research-requests/MyResearchPage.jsx'));
const MyRequest = lazyComponent(() => import('../features/research-requests/MyRequestPage.jsx'));

// Staff
const Dashboard = lazyComponent(() => import('../features/dashboard/DashboardPage.jsx'));
const AdminCollections = lazyComponent(() => import('../features/collections/CollectionsPage.jsx'));
const Repositories = lazyComponent(() => import('../features/collections/RepositoriesPage.jsx'));
const Records = lazyComponent(() => import('../features/archival-records/RecordsListPage.jsx'));
const RecordDetail = lazyComponent(() => import('../features/archival-records/RecordDetailPage.jsx'));
const RecordEditor = lazyComponent(() => import('../features/archival-records/RecordEditorPage.jsx'));
const StaffSearch = lazyComponent(() => import('../features/archival-records/StaffSearchPage.jsx'));
const Transfers = lazyComponent(() => import('../features/accessioning/TransfersPage.jsx'));
const TransferDetail = lazyComponent(() => import('../features/accessioning/TransferDetailPage.jsx'));
const Accessions = lazyComponent(() => import('../features/accessioning/AccessionsPage.jsx'));
const AccessionDetail = lazyComponent(() => import('../features/accessioning/AccessionDetailPage.jsx'));
const Authorities = lazyComponent(() => import('../features/cataloguing/AuthoritiesPage.jsx'));
const AuthorityDetail = lazyComponent(() => import('../features/cataloguing/AuthorityDetailPage.jsx'));
const Vocabularies = lazyComponent(() => import('../features/cataloguing/VocabulariesPage.jsx'));
const Digitisation = lazyComponent(() => import('../features/digitisation/DigitisationPage.jsx'));
const ProjectDetail = lazyComponent(() => import('../features/digitisation/ProjectDetailPage.jsx'));
const BatchDetail = lazyComponent(() => import('../features/digitisation/BatchDetailPage.jsx'));
const OcrQueue = lazyComponent(() => import('../features/digitisation/OcrQueuePage.jsx'));
const OcrReview = lazyComponent(() => import('../features/digitisation/OcrReviewPage.jsx'));
const Preservation = lazyComponent(() => import('../features/preservation/PreservationPage.jsx'));
const AlertDetail = lazyComponent(() => import('../features/preservation/AlertDetailPage.jsx'));
const Assets = lazyComponent(() => import('../features/preservation/AssetsPage.jsx'));
const AssetDetail = lazyComponent(() => import('../features/preservation/AssetDetailPage.jsx'));
const Storage = lazyComponent(() => import('../features/locations/LocationsPage.jsx'));
const LocationDetail = lazyComponent(() => import('../features/locations/LocationDetailPage.jsx'));
const Items = lazyComponent(() => import('../features/locations/ItemsPage.jsx'));
const ItemDetail = lazyComponent(() => import('../features/locations/ItemDetailPage.jsx'));
const InventoryAudit = lazyComponent(() => import('../features/locations/InventoryAuditPage.jsx'));
const RequestsQueue = lazyComponent(() => import('../features/research-requests/RequestsQueuePage.jsx'));
const StaffRequest = lazyComponent(() => import('../features/research-requests/StaffRequestPage.jsx'));
const ReadingRoom = lazyComponent(() => import('../features/circulation/ReadingRoomPage.jsx'));
const Circulation = lazyComponent(() => import('../features/circulation/CirculationPage.jsx'));
const Appraisal = lazyComponent(() => import('../features/appraisal/AppraisalPage.jsx'));
const AppraisalDetail = lazyComponent(() => import('../features/appraisal/AppraisalDetailPage.jsx'));
const Disposal = lazyComponent(() => import('../features/appraisal/DisposalPage.jsx'));
const DisposalDetail = lazyComponent(() => import('../features/appraisal/DisposalDetailPage.jsx'));
const Retention = lazyComponent(() => import('../features/retention/RetentionPage.jsx'));
const Reports = lazyComponent(() => import('../features/reports/ReportsPage.jsx'));
const Audit = lazyComponent(() => import('../features/audit/AuditPage.jsx'));
const AccessRequests = lazyComponent(() => import('../features/permissions/AccessRequestsPage.jsx'));
const Users = lazyComponent(() => import('../features/settings/UsersPage.jsx'));
const UserDetail = lazyComponent(() => import('../features/settings/UserDetailPage.jsx'));
const Roles = lazyComponent(() => import('../features/settings/RolesPage.jsx'));
const Organisation = lazyComponent(() => import('../features/settings/OrganisationPage.jsx'));
const Settings = lazyComponent(() => import('../features/settings/SettingsPage.jsx'));
const System = lazyComponent(() => import('../features/settings/SystemPage.jsx'));
const Imports = lazyComponent(() => import('../features/settings/ImportsPage.jsx'));
const ImportDetail = lazyComponent(() => import('../features/settings/ImportDetailPage.jsx'));
const Account = lazyComponent(() => import('../features/settings/AccountPage.jsx'));

/**
 * Shown when a page fails to load or throws while rendering.
 *
 * @returns {JSX.Element}
 */
function RouteError() {
  const error = useRouteError();
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <ErrorState error={{ message: error?.statusText || error?.message }} title="Something went wrong on this page" />
      <Button variant="secondary" to="/">
        Return home
      </Button>
    </div>
  );
}

/**
 * Shown for addresses that match no page; the message also covers material that is not publicly available.
 *
 * @returns {JSX.Element}
 */
function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="label-eyebrow">404</p>
      <h1 className="mt-2 text-2xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-ink-soft">The page may have moved, or the material may not be publicly available.</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
        Go to the catalogue
      </Link>
    </div>
  );
}

const S = ['records.read'];
export const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: pageElement(Login) },
      { path: '/register', element: pageElement(Register) },
      { path: '/verify-email', element: pageElement(Verify) },
      { path: '/activate', element: pageElement(Activate) },
      { path: '/forgot-password', element: pageElement(Forgot) },
      { path: '/reset-password', element: pageElement(Reset) },
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: pageElement(Home) },
          { path: '/search', element: pageElement(Search) },
          { path: '/collections', element: pageElement(Collections) },
          { path: '/records/:id', element: pageElement(Record) },
          { path: '/records/:id/finding-aid', element: pageElement(FindingAid) },
          { path: '/request', element: pageElement(Request) },
          { path: '/help', element: pageElement(Help) },
          { path: '/my', element: <RequireAuth>{pageElement(MyResearch)}</RequireAuth> },
          { path: '/my/requests/:id', element: <RequireAuth>{pageElement(MyRequest)}</RequireAuth> },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        path: '/admin',
        element: (
          <RequireStaff>
            <AdminLayout />
          </RequireStaff>
        ),
        children: [
          { index: true, element: pageElement(Dashboard, ['dashboard.view']) },
          { path: 'account', element: pageElement(Account) },
          { path: 'collections', element: pageElement(AdminCollections, S) },
          { path: 'repositories', element: pageElement(Repositories, ['repositories.manage']) },
          { path: 'records', element: pageElement(Records, ['records.read', 'transfer.submit']) },
          { path: 'records/new', element: pageElement(RecordEditor, ['records.create']) },
          { path: 'records/:id', element: pageElement(RecordDetail, ['records.read', 'transfer.submit']) },
          { path: 'records/:id/edit', element: pageElement(RecordEditor, ['records.update']) },
          { path: 'search', element: pageElement(StaffSearch, S) },
          { path: 'transfers', element: pageElement(Transfers, ['transfer.submit', 'transfer.review']) },
          { path: 'transfers/:id', element: pageElement(TransferDetail, ['transfer.submit', 'transfer.review']) },
          { path: 'accessions', element: pageElement(Accessions, ['accession.read']) },
          { path: 'accessions/:id', element: pageElement(AccessionDetail, ['accession.read']) },
          { path: 'authorities', element: pageElement(Authorities, ['authority.manage', 'records.read']) },
          { path: 'authorities/:id', element: pageElement(AuthorityDetail, ['authority.manage', 'records.read']) },
          { path: 'vocabularies', element: pageElement(Vocabularies, ['vocabulary.manage']) },
          {
            path: 'digitisation',
            element: pageElement(Digitisation, ['digitisation.manage', 'digitisation.capture', 'digitisation.qa']),
          },
          {
            path: 'digitisation/projects/:id',
            element: pageElement(ProjectDetail, ['digitisation.manage', 'digitisation.capture', 'digitisation.qa']),
          },
          {
            path: 'digitisation/batches/:id',
            element: pageElement(BatchDetail, ['digitisation.manage', 'digitisation.capture', 'digitisation.qa']),
          },
          { path: 'ocr', element: pageElement(OcrQueue, ['ocr.review']) },
          { path: 'ocr/:id', element: pageElement(OcrReview, ['ocr.review']) },
          { path: 'preservation', element: pageElement(Preservation, ['preservation.read']) },
          { path: 'preservation/alerts/:id', element: pageElement(AlertDetail, ['preservation.read']) },
          { path: 'assets', element: pageElement(Assets, ['assets.read']) },
          { path: 'assets/:id', element: pageElement(AssetDetail, ['assets.read']) },
          { path: 'storage', element: pageElement(Storage, ['physical.read']) },
          { path: 'storage/locations/:id', element: pageElement(LocationDetail, ['physical.read']) },
          { path: 'storage/items', element: pageElement(Items, ['physical.read']) },
          { path: 'storage/items/:id', element: pageElement(ItemDetail, ['physical.read']) },
          { path: 'storage/audits/:id', element: pageElement(InventoryAudit, ['physical.audit']) },
          { path: 'research-requests', element: pageElement(RequestsQueue, ['research.manage']) },
          { path: 'research-requests/:id', element: pageElement(StaffRequest, ['research.manage']) },
          { path: 'reading-room', element: pageElement(ReadingRoom, ['appointments.manage']) },
          { path: 'circulation', element: pageElement(Circulation, ['circulation.issue', 'circulation.return']) },
          { path: 'appraisal', element: pageElement(Appraisal, ['appraisal.create', 'appraisal.approve']) },
          { path: 'appraisal/:id', element: pageElement(AppraisalDetail, ['appraisal.create', 'appraisal.approve']) },
          {
            path: 'disposal',
            element: pageElement(Disposal, ['appraisal.create', 'disposal.approve', 'disposal.execute']),
          },
          {
            path: 'disposal/:id',
            element: pageElement(DisposalDetail, ['appraisal.create', 'disposal.approve', 'disposal.execute']),
          },
          {
            path: 'retention',
            element: pageElement(Retention, [
              'retention.manage',
              'legalhold.manage',
              'appraisal.create',
              'appraisal.approve',
            ]),
          },
          {
            path: 'legal-holds',
            element: pageElement(Retention, ['legalhold.manage', 'appraisal.create', 'appraisal.approve']),
          },
          { path: 'reports', element: pageElement(Reports, ['reports.view', 'audit.read']) },
          { path: 'audit', element: pageElement(Audit, ['audit.read']) },
          {
            path: 'access-requests',
            element: pageElement(AccessRequests, ['permissions.approve', 'records.restrict']),
          },
          { path: 'users', element: pageElement(Users, ['users.manage']) },
          { path: 'users/:id', element: pageElement(UserDetail, ['users.manage']) },
          { path: 'roles', element: pageElement(Roles, ['users.manage']) },
          { path: 'organisation', element: pageElement(Organisation, ['organisation.manage']) },
          { path: 'settings', element: pageElement(Settings, ['settings.manage']) },
          { path: 'system', element: pageElement(System, ['system.health']) },
          { path: 'imports', element: pageElement(Imports, ['imports.manage']) },
          { path: 'imports/:id', element: pageElement(ImportDetail, ['imports.manage']) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
