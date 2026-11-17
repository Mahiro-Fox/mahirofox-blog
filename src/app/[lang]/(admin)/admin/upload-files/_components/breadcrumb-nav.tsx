'use client';

import { ArrowLeft } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/shadcn-ui/breadcrumb';
import { Button } from '@/components/shadcn-ui/button';

interface BreadcrumbNavProps {
  currentPath: string;
  breadcrumb: string[];
  onGoBack: () => void;
  onHome: () => void;
  onNavigate: (index: number) => void;
}

/** 面包屑导航 */
export function BreadcrumbNav({
  currentPath,
  breadcrumb,
  onGoBack,
  onHome,
  onNavigate,
}: BreadcrumbNavProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onGoBack}
        disabled={!currentPath}
        className="h-8 w-8"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={onHome} className="cursor-pointer">
              uploads
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumb.map((part, index) => {
            const crumbPath = breadcrumb.slice(0, index + 1).join('/');
            return (
              <BreadcrumbItem key={crumbPath}>
                <BreadcrumbSeparator />
                <BreadcrumbLink
                  onClick={() => onNavigate(index)}
                  className="cursor-pointer"
                >
                  {part}
                </BreadcrumbLink>
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
