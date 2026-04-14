"use client";

import { useState, useEffect, useRef } from "react";
import { TargetAudience } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface AudienceSelectorProps {
  value: TargetAudience;
  onChange: (audience: TargetAudience) => void;
}

export function AudienceSelector({ value, onChange }: AudienceSelectorProps) {
  const [selectedType, setSelectedType] = useState(value.type);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(value.roles || []);
  const [selectedTiers, setSelectedTiers] = useState<string[]>(value.tiers || []);
  const [estimatedReach, setEstimatedReach] = useState<number | null>(null);
  const isInitialMount = useRef(true);

  const roles = [
    { value: "member", label: "Members" },
    { value: "expert", label: "Experts" },
    { value: "admin", label: "Admins" },
  ];

  const tiers = [
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
    { value: "premium", label: "Premium" },
  ];

  useEffect(() => {
    // Skip onChange on initial mount (value already matches initial state)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Build the audience object
    const audience: TargetAudience = { type: selectedType };

    if (selectedType === "role") {
      audience.roles = selectedRoles;
    } else if (selectedType === "subscription_tier") {
      audience.tiers = selectedTiers;
    }

    onChange(audience);

    // Fetch estimated reach
    fetchEstimatedReach(audience);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, selectedRoles, selectedTiers]);

  const fetchEstimatedReach = async (audience: TargetAudience) => {
    // This would call an API endpoint to get estimated user count
    // For now, we'll just set a placeholder
    setEstimatedReach(null);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type as any);
    setSelectedRoles([]);
    setSelectedTiers([]);
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  };

  const toggleTier = (tier: string) => {
    setSelectedTiers((prev) =>
      prev.includes(tier)
        ? prev.filter((t) => t !== tier)
        : [...prev, tier]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Target Audience</CardTitle>
        <CardDescription>
          Choose who will receive this survey
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Audience Type</Label>
          <Select value={selectedType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              <SelectItem value="role">By Role</SelectItem>
              <SelectItem value="subscription_tier">By Subscription Tier</SelectItem>
              <SelectItem value="custom">Custom Selection</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedType === "role" && (
          <div className="space-y-3">
            <Label>Select Roles</Label>
            {roles.map((role) => (
              <div key={role.value} className="flex items-center space-x-2">
                <Checkbox
                  id={role.value}
                  checked={selectedRoles.includes(role.value)}
                  onCheckedChange={() => toggleRole(role.value)}
                />
                <label
                  htmlFor={role.value}
                  className="text-sm cursor-pointer flex-1"
                >
                  {role.label}
                </label>
              </div>
            ))}
            {selectedRoles.length === 0 && (
              <p className="text-sm text-amber-600">
                Please select at least one role
              </p>
            )}
          </div>
        )}

        {selectedType === "subscription_tier" && (
          <div className="space-y-3">
            <Label>Select Subscription Tiers</Label>
            {tiers.map((tier) => (
              <div key={tier.value} className="flex items-center space-x-2">
                <Checkbox
                  id={tier.value}
                  checked={selectedTiers.includes(tier.value)}
                  onCheckedChange={() => toggleTier(tier.value)}
                />
                <label
                  htmlFor={tier.value}
                  className="text-sm cursor-pointer flex-1"
                >
                  {tier.label}
                </label>
              </div>
            ))}
            {selectedTiers.length === 0 && (
              <p className="text-sm text-amber-600">
                Please select at least one tier
              </p>
            )}
          </div>
        )}

        {selectedType === "custom" && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Custom user selection will be available after creating the survey.
              You&apos;ll be able to manually select specific users.
            </p>
          </div>
        )}

        {selectedType === "all" && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              This survey will be sent to all registered members on the platform.
            </p>
          </div>
        )}

        {/* Estimated Reach */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Estimated Reach:
            </span>
            <Badge variant="secondary">
              {estimatedReach !== null
                ? `~${estimatedReach} users`
                : "Calculate after saving"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

