"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type OrbitNotification,
  type OrbitNotificationSeverity,
  type OrbitNotificationSource,
} from "@/app/lib/notificationCenter";

type NotificationCenterDrawerProps = {
  darkMode: boolean;
  notifications: OrbitNotification[];
  open: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenNotification: (notification: OrbitNotification) => void;
};

type NotificationFilter =
  | "All"
  | "Unread"
  | "Critical"
  | "Actions"
  | "Incidents"
  | "Training"
  | "Risks"
  | "Inspections"
  | "AI / Billing";

const filterOptions: NotificationFilter[] = [
  "All",
  "Unread",
  "Critical",
  "Actions",
  "Incidents",
  "Training",
  "Risks",
  "Inspections",
  "AI / Billing",
];

const severityStyles: Record<
  OrbitNotificationSeverity,
  { badge: string; badgeLight: string; icon: string; iconLight: string; dot: string }
> = {
  Info: {
    badge: "border-sky-400/25 bg-sky-500/10 text-sky-300",
    badgeLight: "border-sky-200 bg-sky-50 text-sky-700",
    icon: "border-sky-400/25 bg-sky-500/10 text-sky-300",
    iconLight: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "bg-sky-400",
  },
  Warning: {
    badge: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    badgeLight: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    iconLight: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  Critical: {
    badge: "border-rose-400/30 bg-rose-500/12 text-rose-300",
    badgeLight: "border-rose-200 bg-rose-50 text-rose-700",
    icon: "border-rose-400/30 bg-rose-500/12 text-rose-300",
    iconLight: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-400",
  },
  Success: {
    badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    badgeLight: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    iconLight: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-400",
  },
};

const sourceIcons: Record<OrbitNotificationSource, LucideIcon> = {
  "Action Tracker": ListChecks,
  "Risk Assessments": ShieldAlert,
  Inspections: ClipboardCheck,
  "Training Management": GraduationCap,
  "Incident Management": AlertTriangle,
  "AI / Billing": Bot,
};

const sourceMatchesFilter = (
  source: OrbitNotificationSource,
  filter: NotificationFilter,
) => {
  if (filter === "Actions") return source === "Action Tracker";
  if (filter === "Incidents") return source === "Incident Management";
  if (filter === "Training") return source === "Training Management";
  if (filter === "Risks") return source === "Risk Assessments";
  if (filter === "Inspections") return source === "Inspections";
  if (filter === "AI / Billing") return source === "AI / Billing";
  return true;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function NotificationCenterDrawer({
  darkMode,
  notifications,
  open,
  onClose,
  onMarkAllRead,
  onOpenNotification,
}: NotificationCenterDrawerProps) {
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("All");
  const activeNotifications = notifications.filter((notification) => notification.active);
  const unreadCount = activeNotifications.filter((notification) => !notification.read).length;
  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "Unread") return !notification.read && notification.active;
    if (activeFilter === "Critical") return notification.severity === "Critical";
    if (activeFilter === "All") return true;
    return sourceMatchesFilter(notification.sourceModule, activeFilter);
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close notification center"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside
        aria-label="Notification Center"
        className={`relative flex h-full w-full flex-col border-l shadow-2xl sm:max-w-xl ${
          darkMode
            ? "border-cyan-400/15 bg-[#071225]/98 text-slate-100 shadow-cyan-950/40"
            : "border-slate-200 bg-white/98 text-slate-900 shadow-slate-900/15"
        }`}
      >
        <header
          className={`shrink-0 border-b px-4 py-4 sm:px-5 ${
            darkMode ? "border-white/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold tracking-[0.02em]">
                    Notification Center
                  </h2>
                  <p
                    className={`mt-0.5 text-xs ${
                      darkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {unreadCount} unread operational alert{unreadCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close notification center"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${
                darkMode
                  ? "border-white/10 text-slate-400 hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-200"
                  : "border-slate-200 text-slate-500 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
              }`}
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                darkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Workflow intelligence
            </p>
            <button
              type="button"
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
                darkMode
                  ? "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400/30 hover:text-cyan-200"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
              }`}
              onClick={onMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeFilter === filter
                    ? darkMode
                      ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_18px_rgba(77,235,255,0.12)]"
                      : "border-cyan-300 bg-cyan-50 text-cyan-700 shadow-[0_8px_20px_rgba(8,145,178,0.10)]"
                    : darkMode
                      ? "border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-slate-200"
                      : "border-slate-200 bg-white text-slate-500 hover:border-cyan-300 hover:text-cyan-700"
                }`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {filteredNotifications.length === 0 ? (
            <div
              className={`grid min-h-64 place-items-center rounded-2xl border border-dashed px-6 text-center ${
                darkMode
                  ? "border-white/10 bg-white/[0.02]"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div>
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
                <p className="mt-3 text-sm font-semibold">No notifications in this view</p>
                <p
                  className={`mt-1 text-xs leading-5 ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Operational alerts will appear here as workflow records change.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => {
                const SourceIcon = sourceIcons[notification.sourceModule];
                const palette = severityStyles[notification.severity];

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={`group relative w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition sm:px-4 ${
                      notification.read
                        ? darkMode
                          ? "border-white/[0.07] bg-white/[0.025] hover:border-cyan-400/25 hover:bg-cyan-500/[0.045]"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40"
                        : darkMode
                          ? "border-cyan-400/20 bg-cyan-500/[0.055] hover:border-cyan-300/40 hover:bg-cyan-500/[0.09]"
                          : "border-cyan-200 bg-cyan-50/70 hover:border-cyan-300 hover:bg-cyan-50"
                    }`}
                    onClick={() => onOpenNotification(notification)}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-0.5 transition group-hover:w-1 ${
                        palette.dot
                      }`}
                    />
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                          darkMode ? palette.icon : palette.iconLight
                        }`}
                      >
                        <SourceIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 text-sm font-semibold leading-5">
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span
                              aria-label="Unread"
                              className={`h-2 w-2 shrink-0 rounded-full ${palette.dot}`}
                            />
                          )}
                        </span>
                        <span
                          className={`mt-1 block text-xs leading-5 ${
                            darkMode ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          {notification.message}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                              darkMode ? palette.badge : palette.badgeLight
                            }`}
                          >
                            {notification.severity}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              darkMode ? "text-slate-500" : "text-slate-400"
                            }`}
                          >
                            {notification.sourceModule}
                          </span>
                          <span
                            className={`text-[10px] ${
                              darkMode ? "text-slate-600" : "text-slate-400"
                            }`}
                          >
                            {formatTimestamp(notification.createdAt)}
                          </span>
                          {!notification.active && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                                darkMode
                                  ? "border-white/10 text-slate-500"
                                  : "border-slate-200 text-slate-400"
                              }`}
                            >
                              Resolved
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
