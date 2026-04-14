"use client";
import React, { useState, useRef } from "react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";

import { X } from "lucide-react";

interface DataItem {
  id?: string;
  value?: string;
  name: string;
}

interface SelectPillsProps {
  data: DataItem[];
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (selectedValues: string[]) => void;
  placeholder?: string;
  name?: string;
}

export const SelectPills: React.FC<SelectPillsProps> = ({
  data,
  defaultValue = [],
  value,
  onValueChange,
  placeholder = "Type to search...",
  name,
}) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedPills, setSelectedPills] = useState<string[]>(
    value || defaultValue
  );

  // Update selectedPills when value prop changes
  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedPills(value);
    }
  }, [value]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const radioGroupRef = useRef<HTMLDivElement>(null);

  const filteredItems = data?.filter(
    (item) =>
      item.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedPills.includes(item.name)
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHighlightedIndex(-1);

    // Open the popover when user starts typing
    if (newValue.trim()) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (isOpen && filteredItems.length > 0) {
          // Move focus to first radio button
          const firstRadio = radioGroupRef.current?.querySelector(
            'input[type="radio"]'
          ) as HTMLElement;
          firstRadio?.focus();
          setHighlightedIndex(0);
        }
        break;
      case "Enter":
        e.preventDefault();
        // Add custom item if input has value and no exact match exists
        if (
          inputValue.trim() &&
          !data?.some(
            (item) =>
              item.name.toLowerCase() === inputValue.trim().toLowerCase()
          )
        ) {
          const customItem = {
            id: `custom-${Date.now()}`,
            name: inputValue.trim(),
          };
          handleItemSelect(customItem);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  const handleRadioKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    index: number
  ) => {
    const hasCustomOption =
      inputValue.trim() &&
      !data.some(
        (item) => item.name.toLowerCase() === inputValue.trim().toLowerCase()
      );
    const totalOptions = filteredItems.length + (hasCustomOption ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (index < totalOptions - 1) {
          setHighlightedIndex(index + 1);
          const nextItem = radioGroupRef.current?.querySelector(
            `div:nth-child(${index + 2})`
          ) as HTMLElement;
          if (nextItem) {
            nextItem.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (index > 0) {
          setHighlightedIndex(index - 1);
          const prevItem = radioGroupRef.current?.querySelector(
            `div:nth-child(${index})`
          ) as HTMLElement;
          if (prevItem) {
            prevItem.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        } else {
          inputRef.current?.focus();
          setHighlightedIndex(-1);
        }
        break;
      case "Enter":
        e.preventDefault();
        if (index < filteredItems.length) {
          handleItemSelect(filteredItems[index]);
        } else if (hasCustomOption) {
          // Handle custom item selection
          handleItemSelect({
            id: `custom-${Date.now()}`,
            name: inputValue.trim(),
          });
        }
        inputRef.current?.focus();
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.focus();
        break;
    }
  };

  const handleItemSelect = (item: DataItem) => {
    const newSelectedPills = [...selectedPills, item.name];
    setSelectedPills(newSelectedPills);
    setInputValue("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (onValueChange) {
      onValueChange(newSelectedPills);
    }
  };

  const handlePillRemove = (pillToRemove: string) => {
    const newSelectedPills = selectedPills.filter(
      (pill) => pill !== pillToRemove
    );
    setSelectedPills(newSelectedPills);
    if (onValueChange) {
      onValueChange(newSelectedPills);
    }
  };

  const handleOpenChange = (open: boolean) => {
    // Only allow external close events (like clicking outside)
    if (!open) {
      setIsOpen(false);
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <div className="space-y-2">
        {/* Pills container */}
        {(value || selectedPills).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(value || selectedPills).map((pill) => (
              <Badge
                key={pill}
                variant="secondary"
                onClick={() => handlePillRemove(pill)}
                className="hover:cursor-pointer gap-1 group py-1 px-2 text-xs"
              >
                {pill}
                <button
                  onClick={() => handlePillRemove(pill)}
                  className="appearance-none text-muted-foreground group-hover:text-foreground transition-colors"
                >
                  <X size={10} />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input container */}
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            name={name}
            className="w-full"
          />
        </PopoverAnchor>
      </div>

      <PopoverContent
        className="w-full min-w-[200px]"
        onFocusOutside={(e) => {
          // Prevent closing if focus is in the input
          if (e.target === inputRef.current) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing if interaction is with the input
          if (e.target === inputRef.current) {
            e.preventDefault();
          }
        }}
      >
        <div
          ref={radioGroupRef}
          role="radiogroup"
          aria-label="Pill options"
          onKeyDown={(e) => handleRadioKeyDown(e, highlightedIndex)}
          className="max-h-[200px] overflow-y-auto"
        >
          {filteredItems?.map((item, index) => (
            <div
              key={item.id || item.value || item.name}
              className={cn(
                "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent/70 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
                highlightedIndex === index && "bg-accent"
              )}
            >
              <input
                type="radio"
                id={`pill-${item.name}`}
                name="pill-selection"
                value={item.name}
                className="sr-only"
                checked={highlightedIndex === index}
                onChange={() => handleItemSelect(item)}
              />
              <label
                htmlFor={`pill-${item.name}`}
                className="flex items-center w-full cursor-pointer"
              >
                {item.name}
              </label>
            </div>
          ))}

          {/* Custom item option */}
          {inputValue.trim() &&
            !data?.some(
              (item) =>
                item.name.toLowerCase() === inputValue.trim().toLowerCase()
            ) && (
              <div
                className={cn(
                  "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent/70 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
                  highlightedIndex === filteredItems?.length && "bg-accent"
                )}
              >
                <input
                  type="radio"
                  id={`pill-custom-${inputValue.trim()}`}
                  name="pill-selection"
                  value={inputValue.trim()}
                  className="sr-only"
                  checked={highlightedIndex === filteredItems?.length}
                  onChange={() =>
                    handleItemSelect({
                      id: `custom-${Date.now()}`,
                      name: inputValue.trim(),
                    })
                  }
                />
                <label
                  htmlFor={`pill-custom-${inputValue.trim()}`}
                  className="flex items-center w-full cursor-pointer"
                >
                  <span className="text-muted-foreground">Add &quot;</span>
                  {inputValue.trim()}
                  <span className="text-muted-foreground">&quot;</span>
                </label>
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
