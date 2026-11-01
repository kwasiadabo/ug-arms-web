/**
 * Staff navigation menu: groups of links, each shown only to users holding one of its permissions. The server
 * enforces the same permissions on every page and request.
 *
 * @author Kwasi Adabo Boakye
 */

import {
  LayoutDashboard,
  Library,
  FileText,
  Inbox,
  PackageCheck,
  BookOpen,
  Tags,
  ScanLine,
  FileSearch,
  ShieldCheck,
  HardDrive,
  MapPin,
  Boxes,
  MessageSquareText,
  CalendarDays,
  ArrowLeftRight,
  Scale,
  Gavel,
  Lock,
  BarChart3,
  ScrollText,
  KeyRound,
  Users,
  Shield,
  Building2,
  Settings,
  Upload,
  Activity,
  Archive,
} from 'lucide-react';

// Navigation grouped as specified; each item declares the permissions that make it visible (any-of).
export const NAV = [
  {
    group: 'Overview',
    items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard, any: ['dashboard.view'], end: true }],
  },
  {
    group: 'Collections',
    items: [
      { label: 'Collections & fonds', to: '/admin/collections', icon: Library, any: ['records.read'] },
      { label: 'Repositories', to: '/admin/repositories', icon: Archive, any: ['repositories.manage'] },
    ],
  },
  {
    group: 'Archival Records',
    items: [
      { label: 'Descriptions', to: '/admin/records', icon: FileText, any: ['records.read', 'transfer.submit'] },
      { label: 'Catalogue search', to: '/admin/search', icon: FileSearch, any: ['records.read'] },
    ],
  },
  {
    group: 'Accessioning',
    items: [
      {
        label: 'Transfer submissions',
        to: '/admin/transfers',
        icon: Inbox,
        any: ['transfer.submit', 'transfer.review'],
      },
      { label: 'Accession register', to: '/admin/accessions', icon: PackageCheck, any: ['accession.read'] },
    ],
  },
  {
    group: 'Cataloguing',
    items: [
      {
        label: 'Authority records',
        to: '/admin/authorities',
        icon: BookOpen,
        any: ['authority.manage', 'records.read'],
      },
      { label: 'Vocabularies', to: '/admin/vocabularies', icon: Tags, any: ['vocabulary.manage'] },
    ],
  },
  {
    group: 'Digitisation',
    items: [
      {
        label: 'Projects & batches',
        to: '/admin/digitisation',
        icon: ScanLine,
        any: ['digitisation.manage', 'digitisation.capture', 'digitisation.qa'],
      },
      { label: 'OCR review', to: '/admin/ocr', icon: FileSearch, any: ['ocr.review'] },
    ],
  },
  {
    group: 'Digital Preservation',
    items: [
      { label: 'Preservation', to: '/admin/preservation', icon: ShieldCheck, any: ['preservation.read'] },
      { label: 'Digital assets', to: '/admin/assets', icon: HardDrive, any: ['assets.read'] },
    ],
  },
  {
    group: 'Storage Locations',
    items: [
      { label: 'Locations', to: '/admin/storage', icon: MapPin, any: ['physical.read'] },
      { label: 'Physical items', to: '/admin/storage/items', icon: Boxes, any: ['physical.read'] },
    ],
  },
  {
    group: 'Research Services',
    items: [
      { label: 'Research requests', to: '/admin/research-requests', icon: MessageSquareText, any: ['research.manage'] },
    ],
  },
  {
    group: 'Reading Room',
    items: [
      { label: 'Appointments', to: '/admin/reading-room', icon: CalendarDays, any: ['appointments.manage'] },
      {
        label: 'Circulation desk',
        to: '/admin/circulation',
        icon: ArrowLeftRight,
        any: ['circulation.issue', 'circulation.return'],
      },
    ],
  },
  {
    group: 'Appraisal and Retention',
    items: [
      { label: 'Appraisal cases', to: '/admin/appraisal', icon: Scale, any: ['appraisal.create', 'appraisal.approve'] },
      {
        label: 'Disposal',
        to: '/admin/disposal',
        icon: Gavel,
        any: ['appraisal.create', 'disposal.approve', 'disposal.execute'],
      },
      {
        label: 'Retention & holds',
        to: '/admin/retention',
        icon: Lock,
        any: ['retention.manage', 'legalhold.manage', 'appraisal.create'],
      },
    ],
  },
  {
    group: 'Reports',
    items: [{ label: 'Reports centre', to: '/admin/reports', icon: BarChart3, any: ['reports.view', 'audit.read'] }],
  },
  {
    group: 'Audit and Compliance',
    items: [
      { label: 'Audit explorer', to: '/admin/audit', icon: ScrollText, any: ['audit.read'] },
      {
        label: 'Access approvals',
        to: '/admin/access-requests',
        icon: KeyRound,
        any: ['permissions.approve', 'records.restrict'],
      },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Users', to: '/admin/users', icon: Users, any: ['users.manage'] },
      { label: 'Roles & permissions', to: '/admin/roles', icon: Shield, any: ['users.manage'] },
      { label: 'Organisation', to: '/admin/organisation', icon: Building2, any: ['organisation.manage'] },
      { label: 'Import centre', to: '/admin/imports', icon: Upload, any: ['imports.manage'] },
      { label: 'System health', to: '/admin/system', icon: Activity, any: ['system.health'] },
      { label: 'Settings', to: '/admin/settings', icon: Settings, any: ['settings.manage'] },
    ],
  },
];

/**
 * Returns the menu groups and links the user may see; empty groups are removed.
 *
 * @param {string[]} [permissions=[]] The user's permissions.
 * @returns {Array<{ group: string, items: object[] }>}
 */
export function visibleNav(permissions = []) {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.any.some((p) => permissions.includes(p))) })).filter(
    (g) => g.items.length,
  );
}
