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
  scrollBehavior?: "normal" | "inside" | "outside";
}

export default function ModalView({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  scrollBehavior = "normal",
}: ModalViewProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size={size} scrollBehavior={scrollBehavior}>
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
