import { useContainer as classValidatorUseContainer } from 'class-validator';
import { useContainer as routingUseContainer } from 'routing-controllers';
import { Container } from 'typedi';
export const iocLoader = () => {
  /**
   * Setup routing-controllers to use typedi container.
   */
  routingUseContainer(Container);
  classValidatorUseContainer(Container);
};
iocLoader();
