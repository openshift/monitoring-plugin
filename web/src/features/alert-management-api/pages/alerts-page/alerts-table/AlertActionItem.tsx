import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import type { AccessReviewResourceAttributes } from '@openshift-console/dynamic-plugin-sdk';
import { DropdownItem } from '@patternfly/react-core';
import type { DropdownItemProps } from '@patternfly/react-core';

type AlertActionItemProps = DropdownItemProps & {
  accessReview?: AccessReviewResourceAttributes;
};

function ReviewedAlertActionItem({
  accessReview,
  isDisabled,
  ...props
}: AlertActionItemProps & { accessReview: AccessReviewResourceAttributes }) {
  const [isAllowed, isLoading] = useAccessReview(accessReview);
  const disabled = isDisabled || isLoading || !isAllowed;

  return <DropdownItem {...props} isDisabled={disabled} isAriaDisabled={disabled} />;
}

export function AlertActionItem({ accessReview, ...props }: AlertActionItemProps) {
  if (accessReview) {
    return (
      <ReviewedAlertActionItem
        key={JSON.stringify(accessReview)}
        {...props}
        accessReview={accessReview}
      />
    );
  }

  return <DropdownItem {...props} isAriaDisabled={props.isDisabled || props.isAriaDisabled} />;
}
