import { useState } from 'react';
import { User, TrendingUp, PieChart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileModal } from './ProfileModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const tabs = [
    { id: 'explore', label: 'Explore', icon: Search },
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'trending', label: 'Trending', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              InvestPeople
            </h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsProfileOpen(true)}
            className="bg-secondary border-border hover:bg-accent"
          >
            <User className="h-4 w-4 mr-2" />
            Profile
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-secondary border-t border-border">
        <div className="container max-w-md mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <ProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </div>
  );
};