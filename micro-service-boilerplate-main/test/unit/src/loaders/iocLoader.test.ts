import { useContainer as classValidatorUseContainer } from 'class-validator';
import { useContainer as routingUseContainer } from 'routing-controllers';
import { Container } from 'typedi';
import { iocLoader } from '../../../../src/loaders/iocLoader';

jest.mock('class-validator', () => ({
  useContainer: jest.fn()
}));

jest.mock('routing-controllers', () => ({
  useContainer: jest.fn()
}));

describe('iocLoader', () => {
  it('should set up routing-controllers and class-validator to use the typedi container', () => {
    iocLoader();

    expect(routingUseContainer).toHaveBeenCalledWith(Container);
    expect(classValidatorUseContainer).toHaveBeenCalledWith(Container);
  });
});
