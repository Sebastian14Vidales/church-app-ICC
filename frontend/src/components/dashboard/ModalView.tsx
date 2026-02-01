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
}

export default function ModalView({
  isOpen,
  onClose,
  title,
  children,
}: ModalViewProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
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
