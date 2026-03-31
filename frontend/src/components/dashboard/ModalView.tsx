import { type ReactNode } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@heroui/react";


interface ModalViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
}

export default function ModalView({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalViewProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size={size}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader>{title}</ModalHeader>

            <ModalBody>{children}</ModalBody>

          </>
        )}
      </ModalContent>
    </Modal>
  );
}
