import { useState } from "react";
import { Upload } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { Button, type ButtonVariant } from "~/components/ui/button";
import { StatementImportSheet } from "./statement-import-sheet";

/** The one-line way for a screen to offer statement import; the sheet resolves the card itself. */
export function ImportButton({
  variant = "outline",
  size = "default",
  iconOnly = false,
}: {
  variant?: ButtonVariant;
  size?: "default" | "sm";
  iconOnly?: boolean;
}) {
  const t = useTranslations("Statements");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size={iconOnly ? "icon" : size}
        icon={Upload}
        accessibilityLabel={t("importButton")}
        onPress={() => setOpen(true)}
      >
        {iconOnly ? undefined : t("importButton")}
      </Button>
      <StatementImportSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
