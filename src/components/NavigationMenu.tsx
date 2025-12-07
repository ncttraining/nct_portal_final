import { Shield, Calendar, GraduationCap, Eye, Users, Mail, Tag, MapPin, Building, Award, BookOpen, FileText, Home, DollarSign, UserCog, ChevronDown, Inbox, Menu, X, CalendarClock, DoorOpen, CalendarDays, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

interface NavigationMenuProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface MenuSection {
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
  visible: boolean;
}

export default function NavigationMenu({ currentPage, onNavigate }: NavigationMenuProps) {
  const { profile } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.super_admin;
  const canManageBookings = isAdmin || profile?.can_manage_bookings;
  const canManageCourses = isAdmin || profile?.can_manage_courses;
  const canViewBookings = isAdmin || profile?.can_view_bookings;
  const canManageExpenses = isAdmin || profile?.can_manage_expenses;

  const menuSections: MenuSection[] = [
    {
      label: 'Administration',
      icon: Shield,
      visible: isAdmin,
      items: [
        { id: 'trainer-management', label: 'Trainer Management', icon: UserCog },
        { id: 'user-management', label: 'User Management', icon: Users },
        { id: 'trainer-availability', label: 'Trainer Availability', icon: CalendarClock },
        { id: 'email-templates', label: 'Email Templates', icon: Mail },
        { id: 'email-queue', label: 'Email Queue', icon: Inbox },
        { id: 'trainer-types', label: 'Trainer Type Manager', icon: Tag },
      ],
    },
    {
      label: 'Bookings Management',
      icon: Calendar,
      visible: canManageBookings,
      items: [
        { id: 'course-booking', label: 'Course Booking & Scheduling', icon: BookOpen },
        { id: 'open-courses', label: 'Open Courses Dashboard', icon: CalendarDays },
        { id: 'open-courses-registers', label: 'Open Courses Registers', icon: ClipboardList },
        { id: 'candidates-management', label: 'Candidates', icon: Users },
        { id: 'trainer-map', label: 'Trainer Map', icon: MapPin },
        { id: 'client-management', label: 'Clients', icon: Building },
        { id: 'centre-management', label: 'Centre Management', icon: DoorOpen },
      ],
    },
    {
      label: 'Course Management',
      icon: GraduationCap,
      visible: canManageCourses,
      items: [
        { id: 'certificate-templates', label: 'Certificate Templates', icon: Award },
        { id: 'course-types', label: 'Course Types Manager', icon: FileText },
        { id: 'certificates', label: 'View / Issue Certificates', icon: Award },
      ],
    },
  ];

  const handleItemClick = (itemId: string) => {
    setOpenSection(null);
    setMobileMenuOpen(false);
    setMobileExpandedSection(null);
    onNavigate(itemId);
  };

  const toggleMobileSection = (sectionLabel: string) => {
    setMobileExpandedSection(mobileExpandedSection === sectionLabel ? null : sectionLabel);
  };

  const isViewingSection = (section: MenuSection) => {
    return section.items.some(item => item.id === currentPage);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center gap-1">
        <button
          onClick={() => handleItemClick('home')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
            currentPage === 'home'
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="text-sm font-medium">Home</span>
        </button>

        {menuSections.map((section) => {
          if (!section.visible) return null;

          const Icon = section.icon;
          const isActive = isViewingSection(section);
          const isOpen = openSection === section.label;

          return (
            <div
              key={section.label}
              className="relative"
              onMouseEnter={() => setOpenSection(section.label)}
              onMouseLeave={() => setOpenSection(null)}
            >
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{section.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl min-w-[220px] z-50">
                  <div className="absolute -top-1 left-0 right-0 h-1 bg-transparent" />
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
                          currentPage === item.id
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-300'
                        }`}
                      >
                        <ItemIcon className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {canViewBookings && (
          <button
            onClick={() => handleItemClick('bookings-viewer')}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              currentPage === 'bookings-viewer'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">View Bookings</span>
          </button>
        )}

        {canManageExpenses && (
          <button
            onClick={() => handleItemClick('trainer-expenses')}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              currentPage === 'trainer-expenses'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Expenses</span>
          </button>
        )}
      </nav>

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden flex items-center gap-2 px-3 py-2 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-[73px] right-0 bottom-0 w-80 max-w-[85vw] bg-slate-900 border-l border-slate-800 z-50 lg:hidden overflow-y-auto">
            <div className="p-4 space-y-2">
              <button
                onClick={() => handleItemClick('home')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                  currentPage === 'home'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Home className="w-4 h-4" />
                <span className="text-sm font-medium">Home</span>
              </button>

              {menuSections.map((section) => {
                if (!section.visible) return null;

                const Icon = section.icon;
                const isActive = isViewingSection(section);
                const isExpanded = mobileExpandedSection === section.label;

                return (
                  <div key={section.label}>
                    <button
                      onClick={() => toggleMobileSection(section.label)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{section.label}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="mt-1 ml-4 space-y-1">
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleItemClick(item.id)}
                              className={`w-full flex items-center gap-3 px-4 py-2 rounded transition-colors ${
                                currentPage === item.id
                                  ? 'bg-slate-800 text-white'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <ItemIcon className="w-4 h-4" />
                              <span className="text-sm">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {canViewBookings && (
                <button
                  onClick={() => handleItemClick('bookings-viewer')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                    currentPage === 'bookings-viewer'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">View Bookings</span>
                </button>
              )}

              {canManageExpenses && (
                <button
                  onClick={() => handleItemClick('trainer-expenses')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                    currentPage === 'trainer-expenses'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Expenses</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
