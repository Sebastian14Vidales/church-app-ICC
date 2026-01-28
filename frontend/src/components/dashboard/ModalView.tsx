import { type ReactNode } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";


interface ModalViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  formId?: string;
  children: ReactNode;
}

export default function ModalView({
  isOpen,
  onClose,
  title,
  children,
  formId,
}: ModalViewProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader>{title}</ModalHeader>

            <ModalBody>{children}</ModalBody>

            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cerrar
              </Button>

              {formId && (
                <Button color="primary" type="submit" form={formId}>
                  Guardar
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
